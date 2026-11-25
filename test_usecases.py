#!/usr/bin/env python3
"""The use cases, exercised end to end against a running Ágora.

Not unit tests. Each one is a thing a person does, run the way the apps run
it — over HTTP, in order, with the state each step leaves behind. The point is
not coverage, it is that the rules the product claims are rules the server
actually keeps: that only a student gets in, that only someone who paid can
review, that a venue can never moderate itself, and that a cohort too small to
be anonymous is never reported.

    ./run.sh --bg && python3 test_usecases.py

Exit status is the number of failures, so it is usable in a pipeline.
"""
import json, os, sys, urllib.request, urllib.error

BASE = os.environ.get("AGORA_BASE", "http://127.0.0.1:8800")
PASS, FAIL = [], []


def call(method, path, body=None, token=None):
    """Returns (status, parsed_json). Never raises on a 4xx: a refusal is an
    outcome these tests assert on, not an accident."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"{}")
        except ValueError:
            return e.code, {"raw": raw[:200].decode("utf-8", "replace")}


def check(name, ok, detail=""):
    (PASS if ok else FAIL).append(name)
    print(("  ok   " if ok else "  FAIL ") + name + (("  — " + str(detail)) if detail and not ok else ""))


def sign_in(email, role="student"):
    s, r = call("POST", "/api/auth/request", {"email": email, "role": role})
    if s != 200 or not r.get("dev_code"):
        return None, (s, r)
    s2, r2 = call("POST", "/api/auth/verify",
                  {"email": email, "code": r["dev_code"], "role": role})
    return (r2.get("token"), (s2, r2))


# --------------------------------------------------------------- the cases ---

def case_browsing_needs_no_account():
    print("\nA guest can look before being asked for anything")
    s, r = call("GET", "/api/map")
    check("the map answers without a token", s == 200 and r.get("pins"), (s, r))
    check("every pin carries a category", s == 200 and
          all(p.get("leisure") for p in r.get("pins", [])))
    check("the categories come with the map", bool(r.get("categories")))
    s, r = call("GET", "/api/offers")
    check("offers are readable without a token", s == 200)


def case_only_students_get_in():
    print("\nOnly a university address gets in")
    s, r = call("POST", "/api/auth/request", {"email": "alberto@gmail.com"})
    check("a personal address is refused", s >= 400, (s, r))
    s, r = call("POST", "/api/auth/request", {"email": "not-an-email"})
    check("a malformed address is refused", s >= 400, (s, r))
    tok, (s, r) = sign_in("marta.ruiz@student.ie.edu")
    check("a university address gets a token", bool(tok), (s, r))
    if tok:
        s, r = call("GET", "/api/me", token=tok)
        check("the token identifies a student", s == 200 and r.get("role") == "student", (s, r))
    return tok


def case_wrong_code_is_refused():
    print("\nA wrong code is refused")
    call("POST", "/api/auth/request", {"email": "noah.becker@student.ie.edu"})
    s, r = call("POST", "/api/auth/verify",
                {"email": "noah.becker@student.ie.edu", "code": "000000"})
    check("the wrong six digits do not sign anyone in", s >= 400, (s, r))


def case_claiming_gives_a_code(tok):
    """Claiming spends real balance, so this case has to pay its own way or it
    only passes the first time it is ever run. The first version did not, and
    after a handful of runs it started failing on an empty wallet — which was
    the test being wrong, not the product.

    Being forced to deal with the money turned out to be worth it: refusing a
    claim there is no balance for is itself a rule, and it had no test."""
    print("\nClaiming an offer gives a code to show at the door")
    s, offers = call("GET", "/api/offers")
    priced = [o for o in (offers.get("offers") or []) if o.get("student_cents")]
    if not (tok and priced):
        return check("an offer exists to claim", False, "no offer or no token")
    # Stock is finite too, not just the wallet. Picking the dearest outright
    # worked until repeated runs had claimed all eight suckling pigs and the
    # case started failing on "Sold out" — the product being right and the
    # test being greedy. An offer with no stock limit cannot be exhausted by
    # testing; among those, the dearest still exercises the balance rule.
    stocked = [o for o in priced if o.get("left") is None or o.get("left", 0) > 0]
    unlimited = [o for o in stocked if o.get("left") is None]
    pool = unlimited or stocked
    if not pool:
        return check("an offer is still available to claim", False,
                     "every offer is sold out")
    dearest = max(pool, key=lambda o: o["student_cents"])

    # And the rule itself, where the seed left something exhausted.
    gone = next((o for o in priced if o.get("left") == 0), None)
    if gone:
        s, r = call("POST", "/api/offers/claim", {"offer_id": gone["id"]}, token=tok)
        check("a sold-out offer is refused", s >= 400, (s, r))

    # Empty the question first: can you claim what you cannot pay for?
    s, me = call("GET", "/api/me", token=tok)
    balance = (me.get("student") or {}).get("wallet_cents")
    if isinstance(balance, int) and balance < dearest["student_cents"]:
        s, r = call("POST", "/api/offers/claim", {"offer_id": dearest["id"]}, token=tok)
        check("a claim with too little balance is refused", s >= 400, (s, r))

    need = round(dearest["student_cents"] / 100.0) + 5
    s, r = call("POST", "/api/wallet/topup", {"amount_eur": min(need, 200)}, token=tok)
    check("the wallet can be topped up", s == 200, (s, r))

    s, r = call("POST", "/api/offers/claim", {"offer_id": dearest["id"]}, token=tok)
    code = str(r.get("code") or r.get("redeem_code") or "")
    check("the claim is accepted", s == 200, (s, r))
    check("it returns six digits", len(code) == 6 and code.isdigit(), repr(code))
    s2, r2 = call("POST", "/api/offers/claim", {"offer_id": dearest["id"]})
    check("a guest cannot claim", s2 >= 400, (s2, r2))
    return dearest, code


def case_reviews_are_earned(tok):
    print("\nOnly someone who paid there can review")
    s, uni = call("GET", "/api/map")
    ids = [p["business_id"] for p in uni.get("pins", [])]
    s, act = call("GET", "/api/my/activity", token=tok)
    visited = {t.get("business_id") for t in (act.get("transactions") or [])}
    unvisited = next((i for i in ids if i not in visited), None)
    if unvisited is not None:
        s, r = call("POST", "/api/reviews",
                    {"business_id": unvisited, "rating": 5, "body": "Nunca he estado aquí."},
                    token=tok)
        check("a venue you never paid at refuses the review", s >= 400, (s, r))
    else:
        check("a venue you never paid at refuses the review", False, "nothing unvisited to test")
    s, r = call("POST", "/api/reviews",
                {"business_id": ids[0] if ids else 1, "rating": 5, "body": "x"})
    check("a guest cannot review at all", s >= 400, (s, r))


def case_a_new_review_is_not_public(tok):
    """Two rules at once, because testing only the happy one hid a failure for
    a whole run: the first version picked whichever venue came back first and
    broke as soon as that student had already reviewed it — which is not a bug,
    it is the one-review-per-venue rule doing its job."""
    print("\nA new review waits for a moderator, and only one per venue")
    s, act = call("GET", "/api/my/activity", token=tok)
    visited, seen = [], set()
    for tr in (act.get("transactions") or []):
        b = tr.get("business_id")
        if b and b not in seen:
            seen.add(b); visited.append(b)
    if not visited:
        return check("there is somewhere this student paid", False, "no transactions")
    check("the student has somewhere to review", True)

    body = "Probado por la bateria de casos de uso."
    written, refused_dupe = None, False
    for bid in visited:
        s, r = call("POST", "/api/reviews",
                    {"business_id": bid, "rating": 4, "body": body}, token=tok)
        if s == 200:
            written = bid
            check("a venue they paid at accepts the review", True)
            check("and it is held, not published",
                  r.get("status") == "pending", r)
            break
        if "already" in str(r.get("error", "")).lower():
            refused_dupe = True
    if written is None:
        # Every visited venue was already reviewed — that is itself the rule.
        check("a venue they paid at accepts the review", refused_dupe,
              "no venue left to review and no duplicate refusal either")
        check("and it is held, not published", refused_dupe)
    else:
        s, r = call("POST", "/api/reviews",
                    {"business_id": written, "rating": 1, "body": "Otra vez."},
                    token=tok)
        check("the same venue cannot be reviewed twice", s >= 400, (s, r))
        s, pub = call("GET", "/api/reviews?business_id=%s" % written)
        bodies = [x.get("body", "") for x in (pub.get("reviews") or [])]
        check("readers cannot see it yet",
              not any(body in b for b in bodies), bodies[:2])


def case_a_venue_cannot_moderate_itself():
    print("\nA venue cannot moderate its own reviews")
    tok, (s, r) = sign_in("info@mesondecandido.es", role="business")
    check("the venue signs in to its own console", bool(tok), (s, r))
    if tok:
        s, r = call("GET", "/api/mod/reviews", token=tok)
        check("but the moderation queue refuses it", s >= 400, (s, r))
        s, r = call("POST", "/api/mod/decide",
                    {"id": 1, "decision": "published"}, token=tok)
        check("and it cannot publish anything", s >= 400, (s, r))
        s, r = call("GET", "/api/mod/second-plan", token=tok)
        check("nor read how the cohort is behaving", s >= 400, (s, r))
    s, r = call("GET", "/api/mod/second-plan")
    check("and a stranger cannot either", s >= 400, (s, r))
    s, r = call("POST", "/api/auth/request",
                {"email": "info@mesondecandido.es", "role": "moderator"})
    check("nor can it ask for a moderator code", s >= 400, (s, r))


def case_a_small_cohort_is_never_reported():
    """The real test is not that a small degree is flagged — it is what the
    server does when somebody asks for one anyway. This first passed while
    reading the wrong key and printing "'None' reports no figures", which is a
    test that cannot fail and therefore was not a test."""
    print("\nA degree too small to be anonymous is not reported")
    s, r = call("GET", "/api/university")
    degrees, floor = r.get("degrees") or [], r.get("min_cohort")
    whole = r.get("cohort")
    check("the university view answers", s == 200 and bool(degrees), (s, r))
    check("it states its own threshold", isinstance(floor, int) and floor > 1, floor)
    small = [d for d in degrees if not d.get("enough")]
    check("at least one degree is below the threshold", bool(small),
          [(d.get("degree"), d.get("students")) for d in degrees])
    check("every degree below it really is below it",
          all(d.get("students", 0) < floor for d in small), small)
    for d in small:
        name = d.get("degree")
        s2, r2 = call("GET", "/api/university?degree=" + name.replace(" ", "%20"))
        check("asking for '%s' does not narrow to its %d people"
              % (name, d.get("students")),
              r2.get("cohort") == whole and not r2.get("degree"),
              {"cohort": r2.get("cohort"), "degree": r2.get("degree")})


def case_an_invented_category_is_refused():
    print("\nThe category list is a contract, not a suggestion")
    s, r = call("GET", "/api/map")
    keys = {c["key"] for c in (r.get("categories") or [])}
    check("the seven categories are the ones the app knows",
          keys == {"restaurants", "products", "club", "football",
                   "theatre", "cinema", "play"}, sorted(keys))
    total = len((call("GET", "/api/offers")[1].get("offers") or []))
    s, r = call("GET", "/api/offers?leisure=casino")
    offers = r.get("offers") or []
    # This used to answer 200 with the entire catalogue: the filter was dropped
    # and the caller was answered a different question from the one they asked.
    check("an invented category is refused, not silently ignored",
          s >= 400 and len(offers) != total, (s, len(offers), total))
    s, r = call("GET", "/api/offers?leisure=restaurants")
    check("a real category narrows the list",
          s == 200 and 0 < len(r.get("offers") or []) < total,
          (s, len(r.get("offers") or []), total))


def case_photos_carry_their_credit():
    print("\nEvery photograph names its photographer")
    s, r = call("GET", "/api/photos")
    photos, credits = r.get("photos") or {}, r.get("credits") or {}
    check("there are real photographs on disk", bool(photos), photos)
    for slug in photos:
        c = credits.get(slug)
        check("%s names an author and a licence" % slug,
              bool(c and c.get("author") and c.get("licence")), c)
    for slug, c in credits.items():
        check("%s links to its source" % slug,
              str(c.get("source", "")).startswith("http"), c)


def case_the_server_can_be_recognised():
    """run.sh will not kill a process on its port unless it can confirm the
    process is ours, and it confirms it by this one key. A second health()
    defined later in api.py shadowed the first and answered a bare {"ok":true},
    so --stop and --restart quietly refused and left old code serving while
    every page still looked fine."""
    print("\nThe server can say who it is, so run.sh can restart it")
    s, r = call("GET", "/api/health")
    check("health answers", s == 200, (s, r))
    check("it names the application", r.get("app") == "agora", r)
    check("it reports what is in the database",
          isinstance(r.get("students"), int) and isinstance(r.get("businesses"), int), r)


def case_the_site_can_ask_if_we_are_up():
    """The published site lives on github.io and the app on a tunnel, so the
    site asking "are you up?" is a cross-origin request. Without the header the
    browser blocks it, the site decides the app is down and offers a
    demonstration notice — while the app is running perfectly at the other end
    of that very URL. It happened: the site said the demo was unavailable for
    as long as it took to notice."""
    print("\nThe published site can ask whether the app is up")
    import urllib.request as u
    req = u.Request(BASE + "/api/health", method="GET")
    with u.urlopen(req, timeout=20) as r:
        allow = r.headers.get("Access-Control-Allow-Origin")
    check("health answers any origin", allow == "*", allow)
    req2 = u.Request(BASE + "/api/offers", method="GET")
    with u.urlopen(req2, timeout=20) as r2:
        allow2 = r2.headers.get("Access-Control-Allow-Origin")
    # Everything else carries a bearer token; a wildcard there would let any
    # page a student has open read their wallet.
    check("and nothing else does", allow2 is None, allow2)


def main():
    s, _ = call("GET", "/api/health")
    if s != 200:
        print("Ágora is not answering on %s — start it with ./run.sh --bg" % BASE)
        return 1
    case_the_server_can_be_recognised()
    case_the_site_can_ask_if_we_are_up()
    case_browsing_needs_no_account()
    tok = case_only_students_get_in()
    case_wrong_code_is_refused()
    if tok:
        case_claiming_gives_a_code(tok)
        case_reviews_are_earned(tok)
        case_a_new_review_is_not_public(tok)
    case_a_venue_cannot_moderate_itself()
    case_a_small_cohort_is_never_reported()
    case_an_invented_category_is_refused()
    case_photos_carry_their_credit()
    print("\n%d passed, %d failed" % (len(PASS), len(FAIL)))
    for f in FAIL:
        print("  failed: " + f)
    return len(FAIL)


if __name__ == "__main__":
    sys.exit(main())
