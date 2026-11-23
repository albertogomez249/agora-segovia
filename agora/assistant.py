"""Agora business assistant.

Runs fully offline with a deterministic generator so the demo never depends on a
network call. If ANTHROPIC_API_KEY is set, `llm_rewrite` upgrades the generated
copy with a real model call; everything else (pricing, scheduling, validation)
stays deterministic on purpose, because those are business rules, not prose.
"""
import os, json, re, time, urllib.request

CATEGORIES = {
    "restaurant": {"en": "restaurant", "es": "restaurante",
                   "tags": ["lunch", "dinner", "student menu"],
                   "discount_band": (15, 30), "table_slots": "Mon-Wed 18:00-20:00"},
    "bar":        {"en": "bar", "es": "bar",
                   "tags": ["drinks", "tapas", "evening"],
                   "discount_band": (20, 35), "table_slots": "Mon-Thu 18:00-20:30"},
    "cafe":       {"en": "cafe", "es": "cafeteria",
                   "tags": ["coffee", "study", "breakfast"],
                   "discount_band": (10, 25), "table_slots": "Mon-Fri 09:00-12:00"},
    "shop":       {"en": "shop", "es": "tienda",
                   "tags": ["retail", "student essentials"],
                   "discount_band": (10, 25), "table_slots": ""},
    "culture":    {"en": "cultural venue", "es": "espacio cultural",
                   "tags": ["culture", "events"],
                   "discount_band": (25, 40), "table_slots": ""},
    "sport":      {"en": "sports venue", "es": "instalacion deportiva",
                   "tags": ["sport", "padel", "fitness"],
                   "discount_band": (20, 35), "table_slots": "Mon-Thu 16:00-19:00"},
}

ZONES = {
    "centro":  {"en": "historic centre", "es": "casco historico"},
    "nueva":   {"en": "Nueva Segovia", "es": "Nueva Segovia"},
    "sanlo":   {"en": "San Lorenzo", "es": "San Lorenzo"},
    "zorrilla": {"en": "Jose Zorrilla", "es": "Jose Zorrilla"},
}

# ---------------------------------------------------------------- copywriting

def profile_copy(name, category, zone, highlight):
    c = CATEGORIES.get(category, CATEGORIES["restaurant"])
    z = ZONES.get(zone, ZONES["centro"])
    hl = (highlight or "").strip().rstrip(".")
    en_hl = (" Known for %s." % hl) if hl else ""
    es_hl = (" Conocido por %s." % hl) if hl else ""
    en = ("%s is a %s in %s, a few minutes from campus.%s "
          "Students verified with their university email get a price that is only for them, "
          "and pay straight from the app." % (name, c["en"], z["en"], en_hl))
    es = ("%s es un %s en %s, a pocos minutos del campus.%s "
          "Los estudiantes verificados con su correo universitario tienen un precio solo para ellos, "
          "y pagan desde la app." % (name, c["es"], z["es"], es_hl))
    tags = list(c["tags"])
    for w in re.findall(r"[a-zA-Zaeiouns]{4,}", (hl or "").lower())[:2]:
        if w not in tags:
            tags.append(w)
    return {"description_en": en, "description_es": es, "tags": tags[:6]}


def offer_copy(kind, name, category, item, pct, window):
    c = CATEGORIES.get(category, CATEGORIES["restaurant"])
    item = (item or "").strip() or {"fixed": "the set lunch", "bundle": "the full package",
                                    "twofor": "two tickets", "percent": "your order"}.get(
                                        kind, "your order")
    if kind == "bundle":
        return {"title_en": "%s - %d%% for students" % (item.title(), pct),
                "title_es": "%s - %d%% para estudiantes" % (item.title(), pct),
                "detail_en": "Everything in one price for students. Show your verified pass and pay in the app.",
                "detail_es": "Todo en un precio para estudiantes. Ensena tu pase verificado y paga en la app."}
    if kind == "fixed":
        return {"title_en": "Student menu - %s" % item.title(),
                "title_es": "Menu estudiante - %s" % item.title(),
                "detail_en": "A full menu priced for students, every day. No coupon, no printout.",
                "detail_es": "Un menu completo a precio de estudiante, todos los dias. Sin cupon ni papeles."}
    if kind == "twofor":
        w = window or c["table_slots"] or "Mon-Wed 18:00-20:00"
        return {"title_en": "Two for one, %s" % w,
                "title_es": "Dos por uno, %s" % w,
                "detail_en": "Two for the price of one at %s. Limited places, first come first served." % name,
                "detail_es": "Dos al precio de uno en %s. Plazas limitadas, por orden de llegada." % name}
    return {"title_en": "%d%% off for students" % pct,
            "title_es": "%d%% de descuento para estudiantes" % pct,
            "detail_en": "Valid with a verified university email.",
            "detail_es": "Valido con correo universitario verificado."}

# ------------------------------------------------------------------- pricing

def suggest_discount(category, goal):
    """goal: fill_quiet | attract_new | move_stock"""
    lo, hi = CATEGORIES.get(category, CATEGORIES["restaurant"])["discount_band"]
    if goal == "fill_quiet":
        return hi
    if goal == "move_stock":
        return int(round((lo + hi) / 2.0)) + 5
    return lo + 5


def price_breakdown(list_cents, pct, commission_pct=8.0):
    student = int(round(list_cents * (100 - pct) / 100.0))
    student = max(student, 50)
    commission = int(round(student * commission_pct / 100.0))
    return {
        "list_cents": list_cents,
        "student_cents": student,
        "saved_cents": list_cents - student,
        "commission_cents": commission,
        "net_cents": student - commission,
        "discount_pct": pct,
    }


def margin_warning(student_cents, cost_cents):
    if not cost_cents:
        return None
    if student_cents <= cost_cents:
        return "This price is at or below the cost you gave me. Raise the price or lower the discount."
    margin = (student_cents - cost_cents) / float(student_cents) * 100
    if margin < 25:
        return "Margin after the discount is %.0f%%. That is thin for this category." % margin
    return None

# --------------------------------------------------------- conversation flow

STEPS = ["name", "category", "zone", "highlight", "goal", "item", "price", "review"]

PROMPTS = {
    "name":     "What is the name of your business, exactly as students should see it?",
    "category": "What kind of place is it? (restaurant, bar, cafe, shop, culture, sport)",
    "zone":     "Where are you? (centro, nueva, sanlo, zorrilla)",
    "highlight": "In a few words, what are you known for? (I will write your profile from this.)",
    "goal":     "What do you want Agora to do for you first? (fill_quiet = fill empty hours, attract_new = get new students in, move_stock = move a specific product)",
    "item":     "Which product or menu should I put in front of students?",
    "price":    "What is its normal price in euros? (you can add your cost after a slash, e.g. 12/4.50)",
    "review":   "Here is what I prepared. Publish it?",
}

GOAL_TO_KIND = {"fill_quiet": "table", "attract_new": "menu", "move_stock": "star"}


def next_step(state):
    for s in STEPS:
        if s not in state or state.get(s) in (None, ""):
            return s
    return "review"


def parse_price(text):
    t = (text or "").replace(",", ".")
    nums = re.findall(r"\d+(?:\.\d+)?", t)
    if not nums:
        return None, None
    price = int(round(float(nums[0]) * 100))
    cost = int(round(float(nums[1]) * 100)) if len(nums) > 1 else None
    return price, cost


def build_draft(state):
    cat = state.get("category", "restaurant")
    goal = state.get("goal", "attract_new")
    kind = GOAL_TO_KIND.get(goal, "menu")
    pct = state.get("forced_pct") or suggest_discount(cat, goal)
    pricing = price_breakdown(state["list_cents"], pct)
    copy = offer_copy(kind, state["name"], cat, state.get("item"), pct,
                      CATEGORIES.get(cat, {}).get("table_slots", ""))
    prof = profile_copy(state["name"], cat, state.get("zone", "centro"), state.get("highlight"))
    warn = margin_warning(pricing["student_cents"], state.get("cost_cents"))
    return {"kind": kind, "pricing": pricing, "copy": copy, "profile": prof,
            "window": CATEGORIES.get(cat, {}).get("table_slots", ""), "warning": warn}


def reply_for(step, state, draft=None):
    """Assistant's message for the step it is now asking about."""
    if step == "review" and draft:
        p = draft["pricing"]
        lines = [
            "Done. Here is your setup, in Spanish and English:",
            "",
            "PROFILE - " + draft["profile"]["description_en"],
            "",
            "OFFER - " + draft["copy"]["title_en"],
            "Normal price EUR %.2f, student price EUR %.2f, they save EUR %.2f." % (
                p["list_cents"] / 100.0, p["student_cents"] / 100.0, p["saved_cents"] / 100.0),
            "Agora takes %d%% (EUR %.2f), you keep EUR %.2f per sale." % (
                8, p["commission_cents"] / 100.0, p["net_cents"] / 100.0),
        ]
        if draft["kind"] == "table":
            lines.append("I set it for your quiet hours: %s." % (draft["window"] or "Mon-Wed 18:00-20:00"))
        if draft["warning"]:
            lines.append("")
            lines.append("Heads up: " + draft["warning"])
        lines.append("")
        lines.append("Say 'publish' and students see it immediately, or tell me what to change.")
        return "\n".join(lines)
    return PROMPTS.get(step, "")

# ------------------------------------------------------------- optional model

def llm_rewrite(text, instruction):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    body = json.dumps({
        "model": "claude-haiku-5-5",
        "max_tokens": 400,
        "messages": [{"role": "user", "content": instruction + "\n\n---\n" + text}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body,
        headers={"content-type": "application/json", "x-api-key": key,
                 "anthropic-version": "2023-06-01"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            out = json.loads(r.read())
        return "".join(b.get("text", "") for b in out.get("content", []))
    except Exception:
        return None
