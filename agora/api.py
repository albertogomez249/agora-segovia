"""JSON API for the Agora student app and business console."""
import json, os, time, re
from . import db, assistant, leisure

COMMISSION_PCT = 8.0
EVENT_FEE_CENTS = 120          # per ticket sold
JOB_LISTING_CENTS = 2500       # per job post, charged to the business
PREMIUM_CENTS = 3900           # business subscription, per month
INVITE_CREDIT_CENTS = 500      # both sides, when an invited student signs up
WELCOME_CENTS = 2500           # so a new student can use the app in the first minute

# Who may moderate. Not a business: a venue that can bury its own bad reviews
# is running a marketing page, not a review system. Set AGORA_MODERATORS to a
# comma-separated list of emails; the default is nobody, and the moderation
# console then simply refuses to let anyone in.
MODERATORS = tuple(e.strip().lower() for e in
                   os.environ.get("AGORA_MODERATORS", "").split(",") if e.strip())

TOP_PICK_MIN_REVIEWS = 3     # below this an average is one opinion wearing a crown
TOP_PICK_MIN_AVG = 4.3

STUDENT_DOMAINS = ("student.ie.edu", "ie.edu", "uva.es", "alumnos.uva.es", "estudiante.es")


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


# ------------------------------------------------------------------ helpers

def is_student_email(email):
    return any(email.lower().endswith("@" + d) for d in STUDENT_DOMAINS)


def university_of(email):
    e = email.lower()
    if "ie.edu" in e:
        return "IE University"
    if "uva" in e:
        return "Universidad de Valladolid - Campus Segovia"
    return "Segovia"


def auth(handler_ctx, want=None):
    sub = handler_ctx.get("subject")
    if not sub:
        raise ApiError("Sign in first", 401)
    if want and sub["type"] != want:
        raise ApiError("Wrong account type for this action", 403)
    return sub


def money(c):
    return round((c or 0) / 100.0, 2)


FRESH_DAYS = 14


def _uses(ref_type, ref_id):
    """How many students have used this — but only once that is a crowd.

    Same reason as MIN_COHORT below, and the same number. "3 students used this"
    on a listing in a city with two campuses is close to naming them, and we
    promise on the website that we never show a group under five. Enforced here
    so no screen can forget it: under the threshold the count is simply absent.
    """
    r = db.q("SELECT COUNT(*) n FROM transactions WHERE ref_type=? AND ref_id=? "
             "AND status='completed'", (ref_type, ref_id), one=True)
    n = r["n"] if r else 0
    return n if n >= MIN_COHORT else 0


def decorate_offer(o):
    o["uses"] = _uses("offer", o["id"])
    o["fresh_days"] = int((db.now() - o["created_at"]) / 86400)
    o["fresh"] = o["fresh_days"] <= FRESH_DAYS
    o["list_eur"] = money(o["list_cents"])
    o["student_eur"] = money(o["student_cents"])
    o["saved_eur"] = money(o["list_cents"] - o["student_cents"])
    o["discount_pct"] = int(round(100 - (o["student_cents"] * 100.0 / max(o["list_cents"], 1))))
    o["left"] = max(o["stock"] - o["claimed"], 0) if o["stock"] else None
    o["leisure_en"] = leisure.LABEL_EN.get(o.get("leisure"), "")
    o["leisure_es"] = leisure.LABEL_ES.get(o.get("leisure"), "")
    # A percentage off a basket has no single price, so the number stored
    # alongside it is an example of a typical spend, not the price. Showing it
    # as the price produced "15% in participating shops — €25.50", which a
    # tester flagged as incoherent, and she was right: it reads as two different
    # offers. Flagged here so every screen labels it the same way.
    o["price_is_example"] = o["kind"] == "percent"
    return o


def decorate_event(e):
    e["uses"] = _uses("event", e["id"])
    e["list_eur"] = money(e["list_cents"])
    e["student_eur"] = money(e["student_cents"])
    e["saved_eur"] = money(e["list_cents"] - e["student_cents"])
    e["left"] = max(e["capacity"] - e["sold"], 0)
    e["when"] = time.strftime("%a %d %b, %H:%M", time.localtime(e["starts_at"]))
    e["leisure_en"] = leisure.LABEL_EN.get(e.get("leisure"), "")
    e["leisure_es"] = leisure.LABEL_ES.get(e.get("leisure"), "")
    return e


def decorate_job(j):
    j["pay_eur"] = money(j["pay_cents"])
    return j


# -------------------------------------------------------------------- auth

def auth_request(ctx, body):
    email = (body.get("email") or "").strip().lower()
    role = body.get("role") or "student"
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise ApiError("That is not an email address")
    if role == "student" and not is_student_email(email):
        raise ApiError("Agora is only for students. Use your university email "
                       "(@student.ie.edu, @ie.edu, @uva.es).")
    if role == "business" and is_student_email(email):
        raise ApiError("Use your professional email, not a university one.")
    if role == "moderator" and email not in MODERATORS:
        # Deliberately the same wording whether or not the address exists.
        raise ApiError("That address cannot moderate Agora.")
    code = db.code6()
    db.run("INSERT INTO verifications(email, code, subject_type, payload, expires_at) "
           "VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET code=excluded.code, "
           "subject_type=excluded.subject_type, expires_at=excluded.expires_at",
           (email, code, role, "{}", db.now() + 900))
    existing = db.q("SELECT id FROM %s WHERE email=?" % ("students" if role == "student" else "businesses"),
                    (email,), one=True)
    # In production this is an email. In the demo we hand the code straight back.
    return {"sent": True, "dev_code": code, "existing": bool(existing),
            "university": university_of(email) if role == "student" else None}


def auth_verify(ctx, body):
    email = (body.get("email") or "").strip().lower()
    code = (body.get("code") or "").strip()
    v = db.q("SELECT * FROM verifications WHERE email=?", (email,), one=True)
    if not v or v["code"] != code:
        raise ApiError("Wrong code")
    if v["expires_at"] < db.now():
        raise ApiError("That code expired. Ask for a new one.")
    role = v["subject_type"]
    if role == "student":
        row = db.q("SELECT * FROM students WHERE email=?", (email,), one=True)
        if not row:
            name = (body.get("name") or email.split("@")[0].replace(".", " ").title())
            inviter = None
            code = (body.get("invite") or "").strip().upper()
            if code:
                inviter = db.q("SELECT id FROM students WHERE invite_code=?", (code,), one=True)
            start = WELCOME_CENTS + (INVITE_CREDIT_CENTS if inviter else 0)
            sid = db.run("INSERT INTO students(email,name,university,verified,locale,wallet_cents,"
                         "saved_cents,created_at,invite_code,invited_by) VALUES(?,?,?,1,?,?,0,?,?,?)",
                         (email, name, university_of(email), body.get("locale") or "en", start,
                          db.now(), db.invite_for(name), inviter["id"] if inviter else None))
            if inviter:
                db.run("UPDATE students SET wallet_cents=wallet_cents+? WHERE id=?",
                       (INVITE_CREDIT_CENTS, inviter["id"]))
        else:
            sid = row["id"]
            db.run("UPDATE students SET verified=1 WHERE id=?", (sid,))
        subject_id, subject_type = sid, "student"
    elif role == "moderator":
        if email not in MODERATORS:
            raise ApiError("That address cannot moderate Agora.")
        # No row of their own: a moderator is an email on a list, not an account.
        subject_id, subject_type = 0, "moderator"
    else:
        row = db.q("SELECT * FROM businesses WHERE email=?", (email,), one=True)
        if not row:
            name = (body.get("name") or email.split("@")[1].split(".")[0].title())
            bid = db.run("INSERT INTO businesses(email,name,category,zone,verified,created_at)"
                         " VALUES(?,?,?,?,1,?)",
                         (email, name, body.get("category") or "restaurant",
                          body.get("zone") or "centro", db.now()))
            db.run("INSERT OR IGNORE INTO assistant_state(business_id) VALUES(?)", (bid,))
        else:
            bid = row["id"]
            db.run("UPDATE businesses SET verified=1 WHERE id=?", (bid,))
        subject_id, subject_type = bid, "business"
    tok = db.token()
    db.run("INSERT INTO sessions(token,subject_type,subject_id,created_at) VALUES(?,?,?,?)",
           (tok, subject_type, subject_id, db.now()))
    db.run("DELETE FROM verifications WHERE email=?", (email,))
    return {"token": tok, "role": subject_type, "me": me(ctx_with(subject_type, subject_id), {})}


def ctx_with(t, i):
    return {"subject": {"type": t, "id": i}}


def me(ctx, body):
    sub = auth(ctx)
    if sub["type"] == "moderator":
        return {"role": "moderator", "pending": db.q(
            "SELECT COUNT(*) n FROM reviews WHERE status='pending'", one=True)["n"]}
    if sub["type"] == "student":
        s = db.q("SELECT * FROM students WHERE id=?", (sub["id"],), one=True)
        s["wallet_eur"] = money(s["wallet_cents"])
        s["saved_eur"] = money(s["saved_cents"])
        s["member_since"] = time.strftime("%b %Y", time.localtime(s["created_at"]))
        s["card_no"] = "%04d %04d" % (4200 + s["id"], 1000 + (s["id"] * 7919) % 9000)
        s["invited_count"] = db.q("SELECT COUNT(*) n FROM students WHERE invited_by=?",
                                  (s["id"],), one=True)["n"]
        s["invite_credit_eur"] = money(INVITE_CREDIT_CENTS)
        s["visits"] = db.q("SELECT COUNT(*) n FROM transactions WHERE student_id=? "
                           "AND status='completed'", (s["id"],), one=True)["n"]
        return {"role": "student", "student": s}
    b = db.q("SELECT * FROM businesses WHERE id=?", (sub["id"],), one=True)
    b["tags"] = db.jloads(b["tags"], [])
    return {"role": "business", "business": b}


def health(ctx, body):
    """Unauthenticated. Two callers, one answer.

    run.sh uses "app" to tell our own server apart from whatever else might be
    squatting on the port before it kills anything, and the public site asks
    before it sends anyone across the tunnel — when the tunnel was down on 23
    November the main button led to a browser error, and six testers read that
    as our verification rejecting them, which is the worst possible misreading.

    There used to be a second health() defined further down this file, and
    being later it shadowed this one and answered a bare {"ok": true}. The
    route table registered /api/health twice as well, so the duplicate won
    there too. Nothing looked broken — the site's check still passed — but
    run.sh could no longer recognise its own process, so `--stop` and
    `--restart` quietly refused to do anything and left yesterday's code
    serving. Hence one function, one route, and the test suite checks the key.
    """
    return {"app": "agora", "ok": True,
            "businesses": db.q("SELECT COUNT(*) n FROM businesses", one=True)["n"],
            "students": db.q("SELECT COUNT(*) n FROM students", one=True)["n"]}


def logout(ctx, body):
    tok = ctx.get("token")
    if tok:
        db.run("DELETE FROM sessions WHERE token=?", (tok,))
    return {"ok": True}


# ------------------------------------------------------- student: browse

def leisure_filter(body):
    """The category asked for, refusing one we do not have.

    `?leisure=casino` used to come back with the whole catalogue: the filter
    was silently dropped and the caller was answered a different question from
    the one they asked. Everything that can legitimately send this value gets
    the list of categories from this same API, so an unknown one is a caller
    that is wrong — and the useful thing to do with a wrong caller is tell it,
    not quietly hand it everything.
    """
    key = (body.get("leisure") or "").strip()
    if key and not leisure.known(key):
        raise ApiError("There is no category called %r." % key[:32])
    return leisure.valid(key)


def list_offers(ctx, body):
    where, args = ["o.active=1"], []
    if body.get("zone"):
        where.append("b.zone=?"); args.append(body["zone"])
    if body.get("kind"):
        where.append("o.kind=?"); args.append(body["kind"])
    # Phase 1's primary filter: what you are buying, not the shape of the cut.
    leis = leisure_filter(body)
    if leis:
        where.append("o.leisure=?"); args.append(leis)
    if body.get("q"):
        where.append("(o.title_en LIKE ? OR o.title_es LIKE ? OR b.name LIKE ?)")
        args += ["%%%s%%" % body["q"]] * 3
    rows = db.q(
        "SELECT o.*, b.name AS business_name, b.zone, b.category, b.address, "
        "b.lat, b.lng, b.real_name "
        "FROM offers o JOIN businesses b ON b.id=o.business_id "
        "WHERE %s ORDER BY o.created_at DESC" % " AND ".join(where), args)
    return {"offers": [decorate_offer(o) for o in rows]}


def list_events(ctx, body):
    # Past events were still being listed here while the map already dropped
    # them, so a venue could show a pin whose event had gone and a sheet whose
    # event was still for sale. One rule, in one place: if it has happened, it
    # is not on sale.
    where, args = ["e.active=1", "e.starts_at>=?"], [db.now()]
    if body.get("category"):
        where.append("e.category=?"); args.append(body["category"])
    leis = leisure_filter(body)
    if leis:
        where.append("e.leisure=?"); args.append(leis)
    rows = db.q("SELECT e.*, b.name AS business_name, b.zone, b.address, "
                "b.lat, b.lng, b.real_name FROM events e "
                "JOIN businesses b ON b.id=e.business_id WHERE %s "
                "ORDER BY e.featured DESC, e.starts_at ASC" % " AND ".join(where), args)
    return {"events": [decorate_event(e) for e in rows]}


MIN_COHORT = 5
"""Below five people a "what your degree is doing" count stops being a trend and
starts being a description of named individuals. A degree-year group on either
Segovia campus can be a dozen people, so the threshold is enforced here, in the
query layer, and not left to the interface to remember."""


def university(ctx, body):
    """What students at a university — optionally at one degree — actually buy.

    Aggregate only. Never a list of people, never a count below MIN_COHORT.
    """
    unis = db.q("SELECT university AS name, COUNT(*) AS students FROM students "
                "WHERE verified=1 GROUP BY university ORDER BY students DESC")
    uni = body.get("university") or (unis[0]["name"] if unis else "")

    degrees = db.q("SELECT degree, COUNT(*) AS students FROM students "
                   "WHERE verified=1 AND university=? AND degree<>'' "
                   "GROUP BY degree ORDER BY students DESC", (uni,))
    for d in degrees:
        d["enough"] = d["students"] >= MIN_COHORT

    degree = body.get("degree") or ""
    # A degree too small to aggregate is not selectable, whatever was asked for.
    if degree and not any(d["degree"] == degree and d["enough"] for d in degrees):
        degree = ""

    where = ["s.verified=1", "s.university=?"]
    args = [uni]
    if degree:
        where.append("s.degree=?"); args.append(degree)
    cond = " AND ".join(where)

    size = db.q("SELECT COUNT(*) AS n FROM students s WHERE " + cond, args, one=True)["n"]
    if size < MIN_COHORT:
        return {"universities": unis, "university": uni, "degrees": degrees,
                "degree": degree, "cohort": size, "enough": False,
                "min_cohort": MIN_COHORT, "popular": [], "reviews": []}

    popular = db.q(
        "SELECT b.name, b.id AS business_id, b.lat, b.lng, b.zone, "
        "COUNT(*) AS buys, COUNT(DISTINCT t.student_id) AS people, "
        "SUM(t.saved_cents) AS saved_cents "
        "FROM transactions t JOIN students s ON s.id=t.student_id "
        "JOIN businesses b ON b.id=t.business_id "
        "WHERE " + cond + " GROUP BY b.id "
        "HAVING COUNT(DISTINCT t.student_id) >= ? "
        # Was 2, while the website promised we never show a group under five.
        # A tester read both and caught it: Campus showed "3 students" at Pádel
        # Segovia and "4 students" at the cinema. The promise is the stricter of
        # the two, so the promise wins and the number comes from one constant.
        "ORDER BY buys DESC, people DESC LIMIT 8", args + [MIN_COHORT])
    for r in popular:
        r["saved_eur"] = money(r["saved_cents"] or 0)

    reviews = db.q(
        "SELECT r.rating, r.body, r.created_at, b.name AS business_name, "
        "s.degree, s.year "
        "FROM reviews r JOIN students s ON s.id=r.student_id "
        "JOIN businesses b ON b.id=r.business_id "
        "WHERE r.status='published' AND " + cond + " "
        "ORDER BY r.created_at DESC LIMIT 10", args)

    return {"universities": unis, "university": uni, "degrees": degrees,
            "degree": degree, "cohort": size, "enough": True,
            "min_cohort": MIN_COHORT, "popular": popular, "reviews": reviews}


def map_pins(ctx, body):
    """One pin per venue, with the cheapest thing on offer there right now.

    The map is the front door in phase 1, so it must answer the question a
    student actually has standing in the street: what is near me, in what
    category, and from how much. A venue with no live offer and no live event
    is not a pin — an empty pin is worse than no pin.
    """
    leis = leisure_filter(body)
    pins = []
    for b in db.q("SELECT id,name,category,zone,address,lat,lng,real_name,hours "
                  "FROM businesses WHERE lat IS NOT NULL AND lng IS NOT NULL"):
        oargs = [b["id"]]
        osql = "SELECT leisure,student_cents,list_cents,title_en,title_es FROM offers " \
               "WHERE active=1 AND business_id=?"
        if leis:
            osql += " AND leisure=?"; oargs.append(leis)
        offers = db.q(osql + " ORDER BY student_cents ASC", oargs)

        eargs = [b["id"], db.now()]
        esql = "SELECT leisure,student_cents,list_cents,title_en,title_es,starts_at FROM events " \
               "WHERE active=1 AND business_id=? AND starts_at>=?"
        if leis:
            esql += " AND leisure=?"; eargs.append(leis)
        events = db.q(esql + " ORDER BY starts_at ASC", eargs)

        if not offers and not events:
            continue
        cheapest = min([o["student_cents"] for o in offers] +
                       [e["student_cents"] for e in events])
        # The pin's own category: whatever the cheapest live thing is, so the
        # colour on the map matches the price written under it.
        kinds = [(o["student_cents"], o["leisure"]) for o in offers] + \
                [(e["student_cents"], e["leisure"]) for e in events]
        kinds.sort()
        # "€5 for what?" — five testers asked it in the same session, and they
        # were right: a number floating over a rooftop is not an offer. The pin
        # now carries what the cheapest thing is and what it normally costs, so
        # the price has an object before anyone taps it.
        cheapest_item = min(
            [(o["student_cents"], o["list_cents"], o["title_en"]) for o in offers] +
            [(e["student_cents"], e["list_cents"], e["title_en"]) for e in events])
        pins.append({
            "business_id": b["id"], "name": b["name"], "zone": b["zone"],
            "address": b["address"], "lat": b["lat"], "lng": b["lng"],
            "real_name": bool(b["real_name"]),
            "leisure": kinds[0][1],
            "leisure_en": leisure.LABEL_EN.get(kinds[0][1], ""),
            "leisure_es": leisure.LABEL_ES.get(kinds[0][1], ""),
            "offers": len(offers), "events": len(events),
            "from_eur": money(cheapest),
            "from_what": cheapest_item[2].split(" - ")[0],
            "from_list_eur": money(cheapest_item[1]),
            "best_pct": max(
                [int(round(100 - (o["student_cents"] * 100.0 / max(o["list_cents"], 1))))
                 for o in offers] +
                [int(round(100 - (e["student_cents"] * 100.0 / max(e["list_cents"], 1))))
                 for e in events]),
            "hours": b["hours"],
        })
    pins.sort(key=lambda p: (p["leisure"], p["name"]))
    return {"pins": pins, "categories": leisure.as_json(),
            "centre": {"lat": 40.9481, "lng": -4.1184}}


PHOTO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         "web", "photos")
PHOTO_EXT = (".jpg", ".jpeg", ".png", ".webp", ".avif")


def photos(ctx, body):
    """Which venue photographs actually exist on disk.

    Six testers asked for pictures of the places — it was the most repeated
    request about the catalogue, and the app draws a generated pattern instead.
    Rather than a database column nobody remembers to fill, the index is the
    folder: drop `meson-de-candido.jpg` into web/photos and the venue has a
    photograph. The app asks once, and falls back to the pattern for anything
    not in here, so a missing photo is never a broken image.

    See web/photos/README.md for the naming rule and the shot list.
    """
    out = {}
    try:
        names = sorted(os.listdir(PHOTO_DIR))
    except OSError:
        return {"photos": {}, "credits": {}}
    for n in names:
        stem, ext = os.path.splitext(n)
        if ext.lower() in PHOTO_EXT and not n.startswith("."):
            out.setdefault(stem.lower(), "/photos/" + n)
    # Four of these are other people's photographs, used under CC BY-SA, and
    # that licence is not "free to take": it is free on the condition that the
    # photographer is named. So the credit travels with the listing rather than
    # living in a file nobody reads — if a photo is on screen its author can be
    # on screen too, and a photo whose credit went missing is a licence we are
    # breaking, not a cosmetic omission.
    credits = {}
    try:
        with open(os.path.join(PHOTO_DIR, "credits.json"), encoding="utf-8") as fh:
            credits = json.load(fh)
    except (OSError, ValueError):
        credits = {}
    return {"photos": out, "credits": {k: v for k, v in credits.items() if k in out}}


def venue(ctx, body):
    """Everything one venue holds, in one call.

    Testing on 23 November, thirteen students out of forty-six opened a pin and
    reported the same thing: "I clicked and all I got was reviews". The cause was
    here. The app had no venue endpoint, so tapping a pin fetched every offer and
    every event in Segovia and filtered them in the browser; until both lists
    landed the sheet showed a skeleton, and the reviews — a third, smaller call —
    often painted first. What the venue sells arrived last, or, when a venue's
    only event had already passed, never.

    So: one call, one venue, and the thing it sells comes back with it. The offer
    carries what the price actually buys, because "€5" with no object was the
    second most reported problem on the same day.
    """
    try:
        bid = int(body.get("business_id"))
    except (TypeError, ValueError):
        raise ApiError("Which venue?")
    b = db.q("SELECT id,name,category,zone,address,lat,lng,real_name,hours,"
             "description_en,description_es FROM businesses WHERE id=?", (bid,), one=True)
    if not b:
        raise ApiError("No such venue", 404)

    # The venue's own name and address travel with its offers: an offer sheet
    # opened from here is the same sheet as one opened from the Buy screen, and
    # it should not lose its heading on the way.
    offers = [decorate_offer(o) for o in db.q(
        "SELECT o.*, b.name AS business_name, b.zone, b.address, b.lat, b.lng, b.real_name "
        "FROM offers o JOIN businesses b ON b.id=o.business_id "
        "WHERE o.active=1 AND o.business_id=? ORDER BY o.student_cents ASC", (bid,))]
    events = [decorate_event(e) for e in db.q(
        "SELECT e.*, b.name AS business_name, b.zone, b.address, b.lat, b.lng, b.real_name "
        "FROM events e JOIN businesses b ON b.id=e.business_id "
        "WHERE e.active=1 AND e.business_id=? AND e.starts_at>=? "
        "ORDER BY e.starts_at ASC", (bid, db.now()))]

    rows = _review_rows("r.status='published' AND r.business_id=?", (bid,))
    avg = round(sum(r["rating"] for r in rows) / len(rows), 1) if rows else None

    return {
        "venue": {
            "business_id": b["id"], "name": b["name"], "zone": b["zone"],
            "address": b["address"], "lat": b["lat"], "lng": b["lng"],
            "hours": b["hours"], "real_name": bool(b["real_name"]),
            "description_en": b["description_en"], "description_es": b["description_es"],
        },
        "offers": offers,
        "events": events,
        "rating": {"average": avg, "count": len(rows)},
    }


CALENDAR_DAYS = 14


def calendar(ctx, body):
    """What is on, by day, for the next fortnight.

    "Maybe it's better to set up a calendar so customers can get a better idea
    of the different discount dates." Leisure runs on dates — a premiere on
    Thursday, a home game on Sunday, two-for-one Tuesday to Thursday — and the
    app only ever answered "what is near me", never "what is on on Friday".

    Events have a date of their own. An offer does not: it has a window, which
    is the same answer to the same question, so both are here and each says
    which it is.
    """
    now = db.now()
    until = now + CALENDAR_DAYS * 86400
    leis = leisure.valid(body.get("leisure", ""))
    if body.get("leisure") and not leisure.known(body.get("leisure")):
        raise ApiError("There is no category called '%s'." % body.get("leisure"))

    eargs = [now, until]
    esql = ("SELECT e.*, b.name AS business_name, b.zone, b.address "
            "FROM events e JOIN businesses b ON b.id=e.business_id "
            "WHERE e.active=1 AND e.starts_at>=? AND e.starts_at<=?")
    if leis:
        esql += " AND e.leisure=?"; eargs.append(leis)
    events = [decorate_event(e) for e in db.q(esql + " ORDER BY e.starts_at ASC", eargs)]

    days = {}
    for e in events:
        key = time.strftime("%Y-%m-%d", time.localtime(e["starts_at"]))
        d = days.setdefault(key, {"date": key, "events": [],
                                  "label": time.strftime("%a %d %b", time.localtime(e["starts_at"]))})
        d["events"].append(e)

    oargs = []
    osql = ("SELECT o.*, b.name AS business_name, b.zone, b.address "
            "FROM offers o JOIN businesses b ON b.id=o.business_id "
            "WHERE o.active=1 AND o.window_label<>''")
    if leis:
        osql += " AND o.leisure=?"; oargs.append(leis)
    windows = [decorate_offer(o) for o in
               db.q(osql + " ORDER BY o.student_cents ASC", oargs)]

    return {"days": [days[k] for k in sorted(days)],
            "windows": windows,
            "horizon_days": CALENDAR_DAYS}


# ------------------------------------------------------------------- plans

def _plan_view(p, me_id=None):
    members = db.q(
        "SELECT s.name, pm.student_id FROM plan_members pm "
        "JOIN students s ON s.id=pm.student_id WHERE pm.plan_id=? "
        "ORDER BY pm.joined_at", (p["id"],))
    what, when, venue = "", "", ""
    if p["ref_type"] == "event":
        e = db.q("SELECT e.*, b.name AS business_name FROM events e "
                 "JOIN businesses b ON b.id=e.business_id WHERE e.id=?", (p["ref_id"],), one=True)
        if e:
            e = decorate_event(e)
            what, when, venue = e["title_en"], e["when"], e["business_name"]
    else:
        o = db.q("SELECT o.*, b.name AS business_name FROM offers o "
                 "JOIN businesses b ON b.id=o.business_id WHERE o.id=?", (p["ref_id"],), one=True)
        if o:
            what, when, venue = o["title_en"], o["window_label"] or "Any day", o["business_name"]
    return {
        "id": p["id"], "code": p["code"], "ref_type": p["ref_type"], "ref_id": p["ref_id"],
        "what": what, "when": when, "venue": venue, "note": p["note"],
        # First names only, the same rule the reviews follow.
        "who": [(m["name"] or "").split(" ")[0] for m in members],
        "count": len(members),
        "mine": me_id is not None and p["student_id"] == me_id,
    }


def create_plan(ctx, body):
    """Make a plan out of something and get a code to hand round."""
    sub = auth(ctx, "student")
    ref_type = body.get("ref_type")
    if ref_type not in ("event", "offer"):
        raise ApiError("A plan is made of an event or an offer")
    try:
        ref_id = int(body.get("ref_id"))
    except (TypeError, ValueError):
        raise ApiError("Which one?")
    table = "events" if ref_type == "event" else "offers"
    if not db.q("SELECT 1 FROM %s WHERE id=? AND active=1" % table, (ref_id,), one=True):
        raise ApiError("That is no longer on")

    # One plan per person per thing: making a second is almost always a
    # mis-tap, and two codes for one night is how people end up split up.
    existing = db.q("SELECT * FROM plans WHERE student_id=? AND ref_type=? AND ref_id=?",
                    (sub["id"], ref_type, ref_id), one=True)
    if existing:
        return {"plan": _plan_view(existing, sub["id"]), "created": False}

    code = db.code6()
    pid = db.run("INSERT INTO plans(student_id,ref_type,ref_id,code,note,created_at) "
                 "VALUES(?,?,?,?,?,?)",
                 (sub["id"], ref_type, ref_id, code, (body.get("note") or "")[:140], db.now()))
    db.run("INSERT INTO plan_members(plan_id,student_id,joined_at) VALUES(?,?,?)",
           (pid, sub["id"], db.now()))
    p = db.q("SELECT * FROM plans WHERE id=?", (pid,), one=True)
    return {"plan": _plan_view(p, sub["id"]), "created": True}


def join_plan(ctx, body):
    sub = auth(ctx, "student")
    code = (body.get("code") or "").strip()
    p = db.q("SELECT * FROM plans WHERE code=?", (code,), one=True)
    if not p:
        raise ApiError("No plan with that code")
    db.run("INSERT OR IGNORE INTO plan_members(plan_id,student_id,joined_at) VALUES(?,?,?)",
           (p["id"], sub["id"], db.now()))
    return {"plan": _plan_view(p, sub["id"])}


def my_plans(ctx, body):
    sub = auth(ctx, "student")
    rows = db.q("SELECT p.* FROM plans p JOIN plan_members pm ON pm.plan_id=p.id "
                "WHERE pm.student_id=? ORDER BY p.created_at DESC LIMIT 20", (sub["id"],))
    return {"plans": [_plan_view(p, sub["id"]) for p in rows]}


def list_jobs(ctx, body):
    where, args = ["j.active=1"], []
    if body.get("kind"):
        where.append("j.kind=?"); args.append(body["kind"])
    rows = db.q("SELECT j.*, b.name AS business_name, b.zone, s.name AS student_name "
                "FROM jobs j LEFT JOIN businesses b ON b.id=j.business_id "
                "LEFT JOIN students s ON s.id=j.student_id "
                "WHERE %s ORDER BY j.created_at DESC" % " AND ".join(where), args)
    out = []
    for j in rows:
        j["poster"] = j["business_name"] or (j["student_name"] + " (student)" if j["student_name"] else "Agora")
        out.append(decorate_job(j))
    return {"jobs": out}



# ----------------------------------------------------------------- reviews

def _review_rows(where, args):
    return db.q(
        "SELECT r.id, r.rating, r.body, r.body_lang, r.body_alt, r.created_at, r.status, "
        "b.name AS business_name, b.id AS business_id, "
        "s.name AS student_name, s.degree, s.year, s.university "
        "FROM reviews r JOIN businesses b ON b.id=r.business_id "
        "JOIN students s ON s.id=r.student_id WHERE " + where +
        " ORDER BY r.created_at DESC", args)


def _public_review(r):
    """What a reader sees. A first name, a degree and a year — enough to judge
    whether the reviewer is like you, not enough to find them."""
    keys = r.keys()
    return {"id": r["id"], "rating": r["rating"], "body": r["body"],
            # The language it was written in, and the other one where we have
            # it. The reader's app decides which to show first; both travel, so
            # "show original" costs no second request.
            "lang": (r["body_lang"] if "body_lang" in keys else "") or _guess_lang(r["body"]),
            "body_alt": (r["body_alt"] if "body_alt" in keys else ""),
            "business_id": r["business_id"], "business_name": r["business_name"],
            "author": (r["student_name"] or "").split(" ")[0],
            "degree": r["degree"], "year": r["year"],
            "when": time.strftime("%d %b %Y", time.localtime(r["created_at"]))}


_ES_MARKERS = (" el ", " la ", " los ", " las ", " que ", " con ", " para ", " por ",
               " pero ", " más ", " está ", " muy ", " del ", " una ", " un ", "ñ", "¡", "¿")


def _guess_lang(text):
    """Good enough to label a review, and only used for rows written before the
    language was recorded. Not a language detector; a Spanish-word counter."""
    t = (" " + (text or "").lower() + " ")
    return "es" if sum(t.count(m) for m in _ES_MARKERS) >= 2 else "en"


def list_reviews(ctx, body):
    """Published reviews for one venue, plus whether the caller may add one."""
    try:
        bid = int(body.get("business_id"))
    except (TypeError, ValueError):
        raise ApiError("Which venue?")
    rows = _review_rows("r.status='published' AND r.business_id=?", (bid,))
    out = [_public_review(r) for r in rows]
    avg = round(sum(r["rating"] for r in rows) / len(rows), 1) if rows else None

    can, why, mine = False, "", None
    sub = ctx.get("subject")
    if sub and sub["type"] == "student":
        own = db.q("SELECT id, rating, body, status FROM reviews "
                   "WHERE business_id=? AND student_id=?", (bid, sub["id"]), one=True)
        if own:
            mine = {"rating": own["rating"], "body": own["body"], "status": own["status"]}
            why = "You have already reviewed this one."
        elif _has_visited(sub["id"], bid):
            can = True
        else:
            why = "Only students who have actually paid here can review it."
    elif not sub:
        why = "Verify your university email to review."

    return {"reviews": out, "average": avg, "count": len(out),
            "can_review": can, "why": why, "mine": mine}


def _has_visited(student_id, business_id):
    """The gate on reviews. Not "verified student" — "verified student who paid
    here". It is the one thing a scraped review site cannot copy, and the whole
    reason a price in Agora can be trusted."""
    return bool(db.q("SELECT 1 FROM transactions WHERE student_id=? AND business_id=? "
                     "AND status IN ('pending','completed') LIMIT 1",
                     (student_id, business_id), one=True))


def write_review(ctx, body):
    sub = auth(ctx, "student")
    try:
        bid = int(body.get("business_id"))
        rating = int(body.get("rating"))
    except (TypeError, ValueError):
        raise ApiError("Give a venue and a rating")
    if not 1 <= rating <= 5:
        raise ApiError("A rating runs from 1 to 5")
    text = (body.get("body") or "").strip()
    if len(text) < 15:
        raise ApiError("Write a line or two — fifteen characters at least.")
    if len(text) > 600:
        raise ApiError("Keep it under 600 characters.")
    if not db.q("SELECT 1 FROM businesses WHERE id=?", (bid,), one=True):
        raise ApiError("No such venue")
    if not _has_visited(sub["id"], bid):
        raise ApiError("You can only review a place you have paid for here.")
    if db.q("SELECT 1 FROM reviews WHERE business_id=? AND student_id=?",
            (bid, sub["id"]), one=True):
        raise ApiError("You have already reviewed this one.")
    db.run("INSERT INTO reviews(business_id,student_id,rating,body,body_lang,status,created_at) "
           "VALUES(?,?,?,?,?,'pending',?)",
           (bid, sub["id"], rating, text, _guess_lang(text), db.now()))
    return {"ok": True, "status": "pending",
            "message": "Thanks. A moderator reads it before it appears."}


def top_picks(ctx, body):
    """Earned, never bought. A business can pay to be promoted; it cannot pay
    to be a top pick, because this comes only from moderated student reviews."""
    rows = db.q(
        "SELECT b.id AS business_id, b.name, b.zone, b.lat, b.lng, b.address, "
        "COUNT(r.id) AS reviews, AVG(r.rating) AS avg_rating "
        "FROM businesses b JOIN reviews r ON r.business_id=b.id AND r.status='published' "
        "GROUP BY b.id HAVING COUNT(r.id) >= ? AND AVG(r.rating) >= ? "
        "ORDER BY AVG(r.rating) DESC, COUNT(r.id) DESC",
        (TOP_PICK_MIN_REVIEWS, TOP_PICK_MIN_AVG))
    out = []
    for b in rows:
        cheapest = db.q("SELECT MIN(student_cents) c FROM offers "
                        "WHERE active=1 AND business_id=?", (b["business_id"],), one=True)["c"]
        leis = db.q("SELECT leisure FROM offers WHERE active=1 AND business_id=? "
                    "ORDER BY student_cents LIMIT 1", (b["business_id"],), one=True)
        b["avg_rating"] = round(b["avg_rating"], 1)
        b["from_eur"] = money(cheapest) if cheapest is not None else None
        b["leisure"] = (leis or {}).get("leisure", "")
        b["leisure_en"] = leisure.LABEL_EN.get(b["leisure"], "")
        last = _review_rows("r.status='published' AND r.business_id=?", (b["business_id"],))
        b["quote"] = _public_review(last[0]) if last else None
        out.append(b)
    return {"picks": out, "min_reviews": TOP_PICK_MIN_REVIEWS, "min_avg": TOP_PICK_MIN_AVG}


# --------------------------------------------------------- moderation queue

def mod_queue(ctx, body):
    auth(ctx, "moderator")
    rows = _review_rows("r.status=?", (body.get("status") or "pending",))
    # A moderator sees the whole name: they are accountable for the decision.
    return {"reviews": [dict(r, when=time.strftime("%d %b %Y, %H:%M",
                                                   time.localtime(r["created_at"])))
                        for r in rows],
            "counts": {k: db.q("SELECT COUNT(*) n FROM reviews WHERE status=?",
                               (k,), one=True)["n"]
                       for k in ("pending", "published", "rejected")}}


def mod_decide(ctx, body):
    auth(ctx, "moderator")
    decision = body.get("decision")
    if decision not in ("published", "rejected"):
        raise ApiError("Publish it or reject it")
    try:
        rid = int(body.get("review_id"))
    except (TypeError, ValueError):
        raise ApiError("Which review?")
    row = db.q("SELECT status FROM reviews WHERE id=?", (rid,), one=True)
    if not row:
        raise ApiError("No such review")
    db.run("UPDATE reviews SET status=?, moderated_by=?, moderated_at=? WHERE id=?",
           (decision, ctx["subject"].get("email", "moderator"), db.now(), rid))
    return {"ok": True, "status": decision}


# ------------------------------------------------- student: transactions

def claim_offer(ctx, body):
    sub = auth(ctx, "student")
    oid = int(body.get("offer_id") or 0)
    o = db.q("SELECT o.*, b.id AS bid FROM offers o JOIN businesses b ON b.id=o.business_id "
             "WHERE o.id=? AND o.active=1", (oid,), one=True)
    if not o:
        raise ApiError("That offer is no longer available")
    if o["stock"] and o["claimed"] >= o["stock"]:
        raise ApiError("Sold out")

    # A percentage comes off whatever the student actually spends, which nobody
    # knows until they are at the till. Charging the stored example up front was
    # both wrong and the thing testers objected to most: three of them said they
    # would rather show a code than move money through us at all. So a percent
    # offer issues a code and takes nothing — the till applies the discount.
    pay_here = o["kind"] != "percent"

    st = db.q("SELECT * FROM students WHERE id=?", (sub["id"],), one=True)
    if pay_here and st["wallet_cents"] < o["student_cents"]:
        raise ApiError("Not enough balance in your wallet. Top it up first.")
    code = db.code6()
    paid = o["student_cents"] if pay_here else 0
    commission = int(round(paid * COMMISSION_PCT / 100.0))
    saved = (o["list_cents"] - o["student_cents"]) if pay_here else 0
    writes = [
        ("INSERT INTO transactions(student_id,business_id,ref_type,ref_id,list_cents,paid_cents,"
         "saved_cents,commission_cents,platform_fee_cents,code,status,created_at) "
         "VALUES(?,?,'offer',?,?,?,?,?,0,?,'pending',?)",
         (sub["id"], o["bid"], o["id"], o["list_cents"] if pay_here else 0, paid, saved,
          commission, code, db.now())),
        ("UPDATE offers SET claimed=claimed+1 WHERE id=?", (o["id"],)),
    ]
    if pay_here:
        writes.append(("UPDATE students SET wallet_cents=wallet_cents-? WHERE id=?",
                       (o["student_cents"], sub["id"])))
    db.runmany(writes)
    tx = db.q("SELECT id FROM transactions WHERE code=?", (code,), one=True)["id"]
    if pay_here:
        msg = "Show this code at the till. The venue confirms it and the money is released."
    else:
        pct = int(round(100 - (o["student_cents"] * 100.0 / max(o["list_cents"], 1))))
        msg = ("Show this code at the till. The %d%% comes off what you actually spend — "
               "nothing has been charged." % pct)
    return {"transaction_id": tx, "code": code, "paid_eur": money(paid),
            "saved_eur": money(saved), "pay_here": pay_here, "message": msg}


def buy_ticket(ctx, body):
    sub = auth(ctx, "student")
    eid = int(body.get("event_id") or 0)
    e = db.q("SELECT * FROM events WHERE id=? AND active=1", (eid,), one=True)
    if not e:
        raise ApiError("That event is no longer available")
    if e["sold"] >= e["capacity"]:
        raise ApiError("Sold out")
    st = db.q("SELECT * FROM students WHERE id=?", (sub["id"],), one=True)
    if st["wallet_cents"] < e["student_cents"]:
        raise ApiError("Not enough balance in your wallet. Top it up first.")
    code = db.code6()
    commission = int(round(e["student_cents"] * COMMISSION_PCT / 100.0))
    saved = e["list_cents"] - e["student_cents"]
    db.runmany([
        ("INSERT INTO transactions(student_id,business_id,ref_type,ref_id,list_cents,paid_cents,"
         "saved_cents,commission_cents,platform_fee_cents,code,status,created_at) "
         "VALUES(?,?,'event',?,?,?,?,?,?,?,'completed',?)",
         (sub["id"], e["business_id"], e["id"], e["list_cents"], e["student_cents"], saved,
          commission, EVENT_FEE_CENTS, code, db.now())),
        ("UPDATE transactions SET completed_at=? WHERE code=?", (db.now(), code)),
        ("UPDATE events SET sold=sold+1 WHERE id=?", (e["id"],)),
        ("UPDATE students SET wallet_cents=wallet_cents-?, saved_cents=saved_cents+? WHERE id=?",
         (e["student_cents"], saved, sub["id"])),
    ])
    tx = db.q("SELECT id FROM transactions WHERE code=?", (code,), one=True)["id"]
    return {"ticket_code": code, "transaction_id": tx, "paid_eur": money(e["student_cents"]),
            "saved_eur": money(saved), "message": "Ticket in your wallet. Show the code at the door."}


def apply_job(ctx, body):
    sub = auth(ctx, "student")
    jid = int(body.get("job_id") or 0)
    j = db.q("SELECT * FROM jobs WHERE id=? AND active=1", (jid,), one=True)
    if not j:
        raise ApiError("That listing is closed")
    if j["student_id"] == sub["id"]:
        raise ApiError("This is your own listing")
    existing = db.q("SELECT id FROM applications WHERE job_id=? AND student_id=?", (jid, sub["id"]), one=True)
    if existing:
        raise ApiError("You already applied to this one")
    db.run("INSERT INTO applications(job_id,student_id,message,status,created_at) VALUES(?,?,?,'sent',?)",
           (jid, sub["id"], (body.get("message") or "").strip()[:500], db.now()))
    return {"ok": True, "message": "Application sent. The business sees it in its console."}


def post_tutoring(ctx, body):
    """A student offers to teach. This is the supply side students bring."""
    sub = auth(ctx, "student")
    subject = (body.get("subject") or "").strip()
    pay = body.get("pay_eur")
    if not subject:
        raise ApiError("Say what you can teach")
    try:
        pay_cents = int(round(float(pay) * 100))
    except (TypeError, ValueError):
        raise ApiError("Give an hourly rate in euros")
    if pay_cents < 500 or pay_cents > 6000:
        raise ApiError("Keep the rate between 5 and 60 euros an hour")
    st = db.q("SELECT name FROM students WHERE id=?", (sub["id"],), one=True)
    jid = db.run("INSERT INTO jobs(student_id,kind,title_en,title_es,detail_en,detail_es,"
                 "hours_per_week,pay_cents,schedule,active,created_at) "
                 "VALUES(?,'tutoring',?,?,?,?,0,?,?,1,?)",
                 (sub["id"], "%s tutoring" % subject.title(), "Clases de %s" % subject,
                  "Taught by %s, a verified student. Agora holds the payment." % st["name"],
                  "Impartidas por %s, estudiante verificado. Agora retiene el pago." % st["name"],
                  pay_cents, (body.get("schedule") or "").strip()[:120], db.now()))
    return {"job_id": jid, "message": "Your tutoring listing is live. Agora takes 10% of each hour."}


def topup(ctx, body):
    sub = auth(ctx, "student")
    try:
        cents = int(round(float(body.get("amount_eur")) * 100))
    except (TypeError, ValueError):
        raise ApiError("How much do you want to add?")
    if cents <= 0 or cents > 20000:
        raise ApiError("Between 1 and 200 euros")
    db.run("UPDATE students SET wallet_cents=wallet_cents+? WHERE id=?", (cents, sub["id"]))
    return {"ok": True, "wallet_eur": money(db.q("SELECT wallet_cents FROM students WHERE id=?",
                                                 (sub["id"],), one=True)["wallet_cents"])}


def set_locale(ctx, body):
    sub = auth(ctx, "student")
    loc = body.get("locale")
    if loc not in ("en", "es"):
        raise ApiError("Unknown language")
    db.run("UPDATE students SET locale=? WHERE id=?", (loc, sub["id"]))
    return {"ok": True, "locale": loc}


def my_activity(ctx, body):
    sub = auth(ctx, "student")
    tx = db.q("SELECT t.*, b.name AS business_name FROM transactions t "
              "JOIN businesses b ON b.id=t.business_id WHERE t.student_id=? "
              "ORDER BY t.created_at DESC LIMIT 50", (sub["id"],))
    for t in tx:
        t["paid_eur"] = money(t["paid_cents"]); t["saved_eur"] = money(t["saved_cents"])
        t["when"] = time.strftime("%d %b %H:%M", time.localtime(t["created_at"]))
    apps = db.q("SELECT a.*, j.title_en, j.kind, COALESCE(b.name,'Student') AS poster "
                "FROM applications a JOIN jobs j ON j.id=a.job_id "
                "LEFT JOIN businesses b ON b.id=j.business_id WHERE a.student_id=? "
                "ORDER BY a.created_at DESC", (sub["id"],))
    mine = db.q("SELECT * FROM jobs WHERE student_id=? ORDER BY created_at DESC", (sub["id"],))
    return {"transactions": tx, "applications": apps, "my_listings": [decorate_job(j) for j in mine]}


# ------------------------------------------------------- business console

def biz_dashboard(ctx, body):
    sub = auth(ctx, "business")
    bid = sub["id"]
    agg = db.q("SELECT COUNT(*) n, COALESCE(SUM(paid_cents),0) gross, "
               "COALESCE(SUM(commission_cents),0) comm, COALESCE(SUM(saved_cents),0) saved, "
               "COUNT(DISTINCT student_id) students FROM transactions "
               "WHERE business_id=? AND status='completed'", (bid,), one=True)
    pending = db.q("SELECT COUNT(*) n FROM transactions WHERE business_id=? AND status='pending'",
                   (bid,), one=True)["n"]
    jobs_posted = db.q("SELECT COUNT(*) n FROM jobs WHERE business_id=?", (bid,), one=True)["n"]
    b = db.q("SELECT * FROM businesses WHERE id=?", (bid,), one=True)
    fees = jobs_posted * JOB_LISTING_CENTS + (PREMIUM_CENTS if b["premium"] else 0)
    recent = db.q("SELECT t.*, s.name AS student_name FROM transactions t "
                  "JOIN students s ON s.id=t.student_id WHERE t.business_id=? "
                  "ORDER BY t.created_at DESC LIMIT 12", (bid,))
    for t in recent:
        t["paid_eur"] = money(t["paid_cents"]); t["commission_eur"] = money(t["commission_cents"])
        t["net_eur"] = money(t["paid_cents"] - t["commission_cents"] - t["platform_fee_cents"])
        t["when"] = time.strftime("%d %b %H:%M", time.localtime(t["created_at"]))
    return {
        "business": {"name": b["name"], "premium": b["premium"], "zone": b["zone"],
                     "profile_complete": b["profile_complete"], "category": b["category"],
                     "description_en": b["description_en"], "description_es": b["description_es"],
                     "tags": db.jloads(b["tags"], [])},
        "totals": {
            "sales": agg["n"], "students": agg["students"],
            "gross_eur": money(agg["gross"]), "commission_eur": money(agg["comm"]),
            "net_eur": money(agg["gross"] - agg["comm"]),
            "given_back_eur": money(agg["saved"]),
            "pending": pending,
            "fees_eur": money(fees),
        },
        "counts": {
            "offers": db.q("SELECT COUNT(*) n FROM offers WHERE business_id=? AND active=1", (bid,), one=True)["n"],
            "events": db.q("SELECT COUNT(*) n FROM events WHERE business_id=? AND active=1", (bid,), one=True)["n"],
            "jobs": db.q("SELECT COUNT(*) n FROM jobs WHERE business_id=? AND active=1", (bid,), one=True)["n"],
            "applications": db.q("SELECT COUNT(*) n FROM applications a JOIN jobs j ON j.id=a.job_id "
                                 "WHERE j.business_id=?", (bid,), one=True)["n"],
        },
        "recent": recent,
    }


def biz_items(ctx, body):
    sub = auth(ctx, "business")
    bid = sub["id"]
    offers = [decorate_offer(o) for o in db.q("SELECT * FROM offers WHERE business_id=? ORDER BY created_at DESC", (bid,))]
    events = [decorate_event(e) for e in db.q("SELECT * FROM events WHERE business_id=? ORDER BY starts_at", (bid,))]
    jobs = [decorate_job(j) for j in db.q("SELECT * FROM jobs WHERE business_id=? ORDER BY created_at DESC", (bid,))]
    apps = db.q("SELECT a.*, s.name AS student_name, s.university, j.title_en "
                "FROM applications a JOIN students s ON s.id=a.student_id "
                "JOIN jobs j ON j.id=a.job_id WHERE j.business_id=? ORDER BY a.created_at DESC", (bid,))
    for a in apps:
        a["when"] = time.strftime("%d %b", time.localtime(a["created_at"]))
    return {"offers": offers, "events": events, "jobs": jobs, "applications": apps}


def biz_redeem(ctx, body):
    """The till confirms a student's code: that is what releases the money."""
    sub = auth(ctx, "business")
    code = (body.get("code") or "").strip()
    t = db.q("SELECT * FROM transactions WHERE code=? AND business_id=?", (code, sub["id"]), one=True)
    if not t:
        raise ApiError("No pending code like that here")
    if t["status"] == "completed":
        raise ApiError("That code was already used")
    if t["status"] == "cancelled":
        raise ApiError("That code was cancelled")
    st = db.q("SELECT name, university FROM students WHERE id=?", (t["student_id"],), one=True)
    db.runmany([
        ("UPDATE transactions SET status='completed', completed_at=? WHERE id=?", (db.now(), t["id"])),
        ("UPDATE students SET saved_cents=saved_cents+? WHERE id=?", (t["saved_cents"], t["student_id"])),
    ])
    return {"ok": True, "student": st["name"], "university": st["university"],
            "paid_eur": money(t["paid_cents"]),
            "net_eur": money(t["paid_cents"] - t["commission_cents"]),
            "commission_eur": money(t["commission_cents"]),
            "message": "Confirmed. %s paid %.2f EUR through Agora." % (st["name"], t["paid_cents"] / 100.0)}


def biz_create_offer(ctx, body):
    sub = auth(ctx, "business")
    try:
        lc = int(round(float(body["list_eur"]) * 100))
        sc = int(round(float(body["student_eur"]) * 100))
    except (KeyError, TypeError, ValueError):
        raise ApiError("Give both prices in euros")
    if sc >= lc:
        raise ApiError("The student price has to be lower than the normal price")
    kind = body.get("kind") or "percent"
    if kind not in ("percent", "fixed", "twofor", "bundle"):
        raise ApiError("Unknown kind of offer")
    # Without a leisure category an offer is invisible: it cannot be filtered
    # and it never reaches the map. Fall back to the venue's own nature rather
    # than storing a blank.
    leis = leisure_filter(body)
    if not leis:
        biz = db.q("SELECT category FROM businesses WHERE id=?", (sub["id"],), one=True)
        leis = {"restaurant": "restaurants", "shop": "products", "culture": "theatre",
                "sport": "play", "nightlife": "club"}.get(
                    (biz or {}).get("category"), "products")
    db.run("INSERT INTO offers(business_id,kind,leisure,title_en,title_es,detail_en,detail_es,list_cents,"
           "student_cents,stock,window_label,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?)",
           (sub["id"], kind, leis, body.get("title_en") or "Student offer",
            body.get("title_es") or "Oferta estudiante", body.get("detail_en") or "",
            body.get("detail_es") or "", lc, sc, int(body.get("stock") or 0),
            body.get("window_label") or "", db.now()))
    return {"ok": True}


def biz_create_event(ctx, body):
    sub = auth(ctx, "business")
    try:
        lc = int(round(float(body["list_eur"]) * 100))
        sc = int(round(float(body["student_eur"]) * 100))
        cap = int(body["capacity"])
    except (KeyError, TypeError, ValueError):
        raise ApiError("Give prices and capacity")
    days = float(body.get("in_days") or 3)
    db.run("INSERT INTO events(business_id,category,title_en,title_es,detail_en,detail_es,starts_at,"
           "venue,list_cents,student_cents,capacity,sold,featured,active,created_at) "
           "VALUES(?,?,?,?,?,?,?,?,?,?,?,0,?,1,?)",
           (sub["id"], body.get("category") or "party", body.get("title_en") or "Student night",
            body.get("title_es") or "Noche estudiante", body.get("detail_en") or "",
            body.get("detail_es") or "", db.now() + int(days * 86400), body.get("venue") or "",
            lc, sc, cap, 1 if body.get("featured") else 0, db.now()))
    return {"ok": True, "fee_note": "Agora charges %.2f EUR per ticket sold." % (EVENT_FEE_CENTS / 100.0)}


def biz_create_job(ctx, body):
    sub = auth(ctx, "business")
    try:
        pay = int(round(float(body["pay_eur"]) * 100))
    except (KeyError, TypeError, ValueError):
        raise ApiError("Give an hourly rate")
    db.run("INSERT INTO jobs(business_id,kind,title_en,title_es,detail_en,detail_es,hours_per_week,"
           "pay_cents,schedule,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,1,?)",
           (sub["id"], body.get("kind") or "job", body.get("title_en") or "Student job",
            body.get("title_es") or "Empleo estudiante", body.get("detail_en") or "",
            body.get("detail_es") or "", float(body.get("hours_per_week") or 0), pay,
            body.get("schedule") or "", db.now()))
    return {"ok": True, "fee_note": "Listing fee %.2f EUR for 30 days." % (JOB_LISTING_CENTS / 100.0)}


def biz_toggle(ctx, body):
    sub = auth(ctx, "business")
    table = body.get("type")
    if table not in ("offers", "events", "jobs"):
        raise ApiError("Unknown item")
    db.run("UPDATE %s SET active = 1-active WHERE id=? AND business_id=?" % table,
           (int(body.get("id") or 0), sub["id"]))
    return {"ok": True}


def biz_premium(ctx, body):
    sub = auth(ctx, "business")
    db.run("UPDATE businesses SET premium=? WHERE id=?", (1 if body.get("on") else 0, sub["id"]))
    return {"ok": True, "premium": bool(body.get("on")),
            "note": "Premium is %.2f EUR a month and unlocks the assistant's campaigns." % (PREMIUM_CENTS / 100.0)}


# --------------------------------------------------- business AI assistant

def _astate(bid):
    row = db.q("SELECT * FROM assistant_state WHERE business_id=?", (bid,), one=True)
    if not row:
        db.run("INSERT INTO assistant_state(business_id) VALUES(?)", (bid,))
        row = {"state": "{}", "draft": "{}", "messages": "[]"}
    return (db.jloads(row["state"], {}), db.jloads(row["draft"], {}), db.jloads(row["messages"], []))


def _asave(bid, state, draft, messages):
    db.run("UPDATE assistant_state SET state=?, draft=?, messages=? WHERE business_id=?",
           (json.dumps(state), json.dumps(draft), json.dumps(messages[-40:]), bid))


def _say(messages, who, text, actions=None):
    messages.append({"who": who, "text": text, "actions": actions or [], "at": db.now()})


def assistant_start(ctx, body):
    sub = auth(ctx, "business")
    state, draft, messages = _astate(sub["id"])
    if not messages:
        b = db.q("SELECT name FROM businesses WHERE id=?", (sub["id"],), one=True)
        _say(messages, "assistant",
             "I am the Agora assistant. In about a minute I will write your profile in Spanish and "
             "English, price a student offer, and put you in front of the students of Segovia.\n\n"
             + assistant.PROMPTS["name"],
             [{"label": b["name"], "send": b["name"]}])
        _asave(sub["id"], state, draft, messages)
    return {"messages": messages, "draft": draft, "state": state}


def assistant_reset(ctx, body):
    sub = auth(ctx, "business")
    _asave(sub["id"], {}, {}, [])
    return assistant_start(ctx, {})


SUGGEST_AFTER = [
    {"label": "Also publish an event", "send": "event"},
    {"label": "Also post a student job", "send": "job"},
]


def assistant_message(ctx, body):
    sub = auth(ctx, "business")
    bid = sub["id"]
    text = (body.get("message") or "").strip()
    if not text:
        raise ApiError("Say something")
    state, draft, messages = _astate(bid)
    _say(messages, "business", text)
    low = text.lower()

    # ---- after the first publish: quick extras that cover the other verticals
    if state.get("published"):
        wants_publish = "publish" in low or low in ("yes", "ok", "si", "sí", "go")
        if wants_publish and draft.get("event") and ("event" in low or not draft.get("job")):
            d = draft.pop("event")
            db.run("INSERT INTO events(business_id,category,title_en,title_es,detail_en,detail_es,"
                   "starts_at,venue,list_cents,student_cents,capacity,sold,featured,active,created_at) "
                   "VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0,1,?)",
                   (bid, d["category"], d["title_en"], d["title_es"], d["detail_en"], d["detail_es"],
                    d["starts_at"], d["venue"], d["list_cents"], d["student_cents"], d["capacity"], db.now()))
            _say(messages, "assistant", "Live. Students see it in Events right now.", SUGGEST_AFTER)
        elif wants_publish and draft.get("job"):
            d = draft.pop("job")
            db.run("INSERT INTO jobs(business_id,kind,title_en,title_es,detail_en,detail_es,"
                   "hours_per_week,pay_cents,schedule,active,created_at) VALUES(?,'job',?,?,?,?,?,?,?,1,?)",
                   (bid, d["title_en"], d["title_es"], d["detail_en"], d["detail_es"],
                    d["hours_per_week"], d["pay_cents"], d["schedule"], db.now()))
            _say(messages, "assistant", "Posted. Applications land in your console.", SUGGEST_AFTER)
        elif "event" in low:
            d = _draft_event(state)
            draft["event"] = d
            _say(messages, "assistant",
                 "Drafted an event for you:\n\n%s\nNormal %.2f EUR, students %.2f EUR, %d places, %s.\n"
                 "Agora charges %.2f EUR per ticket sold. Publish it?"
                 % (d["title_en"], d["list_cents"] / 100.0, d["student_cents"] / 100.0,
                    d["capacity"], d["when"], EVENT_FEE_CENTS / 100.0),
                 [{"label": "Publish the event", "send": "publish event"}])
        elif "job" in low:
            d = _draft_job(state)
            draft["job"] = d
            _say(messages, "assistant",
                 "Drafted a job for you:\n\n%s\n%.1f h a week at %.2f EUR an hour, %s.\n"
                 "Listing fee %.2f EUR for 30 days. Publish it?"
                 % (d["title_en"], d["hours_per_week"], d["pay_cents"] / 100.0, d["schedule"],
                    JOB_LISTING_CENTS / 100.0),
                 [{"label": "Publish the job", "send": "publish job"}])
        else:
            _say(messages, "assistant",
                 "I can also put you in Events or post a student job. Which one?", SUGGEST_AFTER)
        _asave(bid, state, draft, messages)
        return {"messages": messages, "draft": draft, "state": state}

    step = assistant.next_step(state)

    # ---- the review step: publish or adjust
    if step == "review":
        d = assistant.build_draft(state)
        if "publish" in low or low in ("yes", "ok", "si", "sí", "go"):
            _publish_setup(bid, state, d)
            state["published"] = True
            _say(messages, "assistant",
                 "Published. Your profile is live in Spanish and English, and the offer is in front of "
                 "every verified student in Segovia right now.", SUGGEST_AFTER)
            _asave(bid, state, {}, messages)
            return {"messages": messages, "draft": {}, "state": state, "published": True}
        m = re.search(r"(\d{1,2})\s*%", low)
        if m:
            pct = max(5, min(70, int(m.group(1))))
            state["forced_pct"] = pct
            d = assistant.build_draft(state)
            d["pricing"] = assistant.price_breakdown(state["list_cents"], pct)
            d["copy"] = assistant.offer_copy(d["kind"], state["name"], state["category"],
                                             state.get("item"), pct, d["window"])
            draft = d
            _say(messages, "assistant", assistant.reply_for("review", state, d),
                 [{"label": "Publish", "send": "publish"}])
            _asave(bid, state, draft, messages)
            return {"messages": messages, "draft": draft, "state": state}
        _say(messages, "assistant",
             "Tell me a percentage (for example '25%') and I will reprice it, or say publish.",
             [{"label": "Publish", "send": "publish"}])
        _asave(bid, state, d, messages)
        return {"messages": messages, "draft": d, "state": state}

    # ---- collecting answers
    if step == "price":
        price, cost = assistant.parse_price(text)
        if not price:
            _say(messages, "assistant", "I need a number, like 12 or 12/4.50 if you want to add your cost.")
            _asave(bid, state, draft, messages)
            return {"messages": messages, "draft": draft, "state": state}
        state["list_cents"] = price
        state["cost_cents"] = cost
        state["price"] = text
    elif step == "category":
        key = next((k for k in assistant.CATEGORIES if k in low), None)
        if not key:
            _say(messages, "assistant", "Pick one: restaurant, bar, cafe, shop, culture, sport.")
            _asave(bid, state, draft, messages)
            return {"messages": messages, "draft": draft, "state": state}
        state["category"] = key
    elif step == "zone":
        key = next((k for k in assistant.ZONES if k in low), None)
        state["zone"] = key or "centro"
    elif step == "goal":
        key = next((g for g in ("fill_quiet", "attract_new", "move_stock") if g in low), None)
        if not key:
            key = ("fill_quiet" if "empty" in low or "quiet" in low else
                   "move_stock" if "stock" in low or "product" in low else "attract_new")
        state["goal"] = key
    else:
        state[step] = text

    nxt = assistant.next_step(state)
    if nxt == "review":
        d = assistant.build_draft(state)
        draft = d
        _say(messages, "assistant", assistant.reply_for("review", state, d),
             [{"label": "Publish", "send": "publish"}, {"label": "Make it 25%", "send": "25%"}])
    else:
        _say(messages, "assistant", assistant.PROMPTS[nxt], _quick(nxt, state))
    _asave(bid, state, draft, messages)
    return {"messages": messages, "draft": draft, "state": state}


def _quick(step, state):
    if step == "category":
        return [{"label": k, "send": k} for k in ("restaurant", "bar", "cafe", "shop")]
    if step == "zone":
        return [{"label": "Historic centre", "send": "centro"}, {"label": "Nueva Segovia", "send": "nueva"},
                {"label": "San Lorenzo", "send": "sanlo"}, {"label": "Jose Zorrilla", "send": "zorrilla"}]
    if step == "goal":
        return [{"label": "Fill my empty hours", "send": "fill_quiet"},
                {"label": "Get new students in", "send": "attract_new"},
                {"label": "Move a product", "send": "move_stock"}]
    return []


def _publish_setup(bid, state, d):
    prof = d["profile"]; p = d["pricing"]; c = d["copy"]
    db.runmany([
        ("UPDATE businesses SET name=?, category=?, zone=?, description_en=?, description_es=?, "
         "tags=?, profile_complete=1, premium=1 WHERE id=?",
         (state["name"], state["category"], state.get("zone", "centro"),
          prof["description_en"], prof["description_es"], json.dumps(prof["tags"]), bid)),
        ("INSERT INTO offers(business_id,kind,title_en,title_es,detail_en,detail_es,list_cents,"
         "student_cents,stock,window_label,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?)",
         (bid, d["kind"], c["title_en"], c["title_es"], c["detail_en"], c["detail_es"],
          p["list_cents"], p["student_cents"], 20 if d["kind"] == "table" else 0,
          d["window"] if d["kind"] == "table" else "", db.now())),
    ])


def _evening(ts):
    lt = time.localtime(ts)
    return int(time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 20, 0, 0, 0, 0, -1)))


def _draft_event(state):
    cat = state.get("category", "restaurant")
    kind = {"bar": "party", "culture": "theatre", "sport": "sport_play",
            "cafe": "concert", "restaurant": "party", "shop": "tour"}.get(cat, "party")
    base = {"party": ("Student night at %s", "Noche estudiante en %s", 1000, 500, 80),
            "theatre": ("Student seats at %s", "Entradas estudiante en %s", 1800, 900, 40),
            "concert": ("Live music at %s", "Musica en directo en %s", 1200, 600, 50),
            "sport_play": ("Padel tournament at %s", "Torneo de padel en %s", 1600, 900, 24),
            "tour": ("Guided walk from %s", "Ruta guiada desde %s", 1500, 700, 30)}[kind]
    return {"category": kind, "title_en": base[0] % state["name"], "title_es": base[1] % state["name"],
            "detail_en": "Student price with your verified Agora pass. Pay in the app.",
            "detail_es": "Precio estudiante con tu pase Agora verificado. Paga en la app.",
            "starts_at": _evening(db.now() + 4 * 86400), "venue": state["name"],
            "list_cents": base[2], "student_cents": base[3], "capacity": base[4],
            "when": time.strftime("%a %d %b, %H:%M", time.localtime(_evening(db.now() + 4 * 86400)))}


def _draft_job(state):
    cat = state.get("category", "restaurant")
    base = {"restaurant": ("Waiter, evenings", "Camarero/a, tardes", 12.0, 900, "Thu-Sat 19:00-23:00"),
            "bar": ("Bar staff, weekends", "Personal de barra, fines de semana", 10.0, 900, "Fri-Sat evenings"),
            "cafe": ("Barista, mornings", "Barista, mananas", 15.0, 950, "Mon-Fri 08:00-12:00"),
            "shop": ("Shop assistant", "Dependiente/a", 12.0, 950, "Sat all day"),
            "culture": ("Event staff", "Personal de eventos", 8.0, 1000, "By event"),
            "sport": ("Court attendant", "Monitor de pista", 10.0, 950, "Afternoons")}.get(
                cat, ("Student job", "Empleo estudiante", 10.0, 900, "Flexible"))
    return {"title_en": base[0], "title_es": base[1], "hours_per_week": base[2],
            "pay_cents": base[3], "schedule": base[4],
            "detail_en": "Open to verified students. Apply from the Agora app.",
            "detail_es": "Abierto a estudiantes verificados. Inscribete desde la app de Agora."}


# -------------------------------------------------------------- dispatcher

ROUTES = {
    ("GET",  "/api/health"): health,
    ("GET",  "/api/calendar"): calendar,
    ("GET",  "/api/plans"): my_plans,
    ("POST", "/api/plans"): create_plan,
    ("POST", "/api/plans/join"): join_plan,
    ("POST", "/api/auth/request"): auth_request,
    ("POST", "/api/auth/verify"): auth_verify,
    ("POST", "/api/auth/logout"): logout,
    ("GET",  "/api/me"): me,
    ("GET",  "/api/offers"): list_offers,
    ("GET",  "/api/map"): map_pins,
    ("GET",  "/api/venue"): venue,
    ("GET",  "/api/photos"): photos,
    ("GET",  "/api/university"): university,
    ("GET",  "/api/reviews"): list_reviews,
    ("POST", "/api/reviews"): write_review,
    ("GET",  "/api/top-picks"): top_picks,
    ("GET",  "/api/mod/reviews"): mod_queue,
    ("POST", "/api/mod/decide"): mod_decide,
    ("GET",  "/api/events"): list_events,
    ("GET",  "/api/jobs"): list_jobs,
    ("POST", "/api/offers/claim"): claim_offer,
    ("POST", "/api/events/buy"): buy_ticket,
    ("POST", "/api/jobs/apply"): apply_job,
    ("POST", "/api/jobs/tutoring"): post_tutoring,
    ("POST", "/api/wallet/topup"): topup,
    ("POST", "/api/me/locale"): set_locale,
    ("GET",  "/api/my/activity"): my_activity,
    ("GET",  "/api/biz/dashboard"): biz_dashboard,
    ("GET",  "/api/biz/items"): biz_items,
    ("POST", "/api/biz/redeem"): biz_redeem,
    ("POST", "/api/biz/offers"): biz_create_offer,
    ("POST", "/api/biz/events"): biz_create_event,
    ("POST", "/api/biz/jobs"): biz_create_job,
    ("POST", "/api/biz/toggle"): biz_toggle,
    ("POST", "/api/biz/premium"): biz_premium,
    ("GET",  "/api/biz/assistant"): assistant_start,
    ("POST", "/api/biz/assistant"): assistant_message,
    ("POST", "/api/biz/assistant/reset"): assistant_reset,
}


def dispatch(method, path, ctx, body):
    fn = ROUTES.get((method, path))
    if not fn:
        raise ApiError("No such endpoint: %s %s" % (method, path), 404)
    return fn(ctx, body or {})
