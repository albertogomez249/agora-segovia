# Ágora — student app + business console

A working end-to-end prototype of the Ágora pitch: a student app for Segovia and the
business console with the AI assistant that feeds it.

Everything runs on **Python 3 standard library + SQLite**. No Node, no npm, no pip
installs, no build step — this machine has no Node runtime, so the stack was chosen to
start anywhere with one command.

```sh
./run.sh --bg         # start detached — survives closing the terminal
./run.sh              # same, but in the foreground (Ctrl-C to stop)
./run.sh --seed       # reset the demo data, then start
./run.sh --restart    # stop the running copy and start again
./run.sh --log        # follow the log of a detached run
./run.sh --stop       # stop it
PORT=8801 ./run.sh    # somewhere else
```

Use `--bg` if you are running it from an editor terminal or anything that may close
the shell: a foreground run dies with its shell, a detached one does not.

Running it twice is safe: it notices Ágora is already up, prints the links and exits
rather than failing on the port. If something that is *not* Ágora holds the port, it says
so and refuses to kill it.

- Student app → <http://localhost:8800/student/> (open narrow, it is a phone layout)
- Business console → <http://localhost:8800/business/>

## The three verticals built

Of the seven screens in the deck, these three are implemented end to end:

| Vertical | Why this one |
|---|---|
| **Shop & Dine** | The commission line and the premium subscription both live here — about 75% of month-12 revenue in the model. Without it there is no business. |
| **Events** | Second revenue line, the highest-frequency reason a student opens the app, and it proves ticketing works. |
| **Jobs & tutoring** | The retention twist: the student stops being only a customer and becomes supply. It is also the only vertical with two-sided posting. |

They share one decisive property: **all three are supplied by the same business account**.
A venue signs up once, and the assistant can publish an offer, an event and a job from the
same conversation. Market (C2C goods and rooms) and Services (taxi, laundry) were left out
on purpose — they need a different supply side (students, taxi drivers) and would double the
onboarding work without proving anything new about the model.

## What a demo looks like

1. **Student** signs in with `marta.ruiz@student.ie.edu` (any `@student.ie.edu`, `@ie.edu`
   or `@uva.es` works; anything else is rejected — that is what makes a discount a *student*
   discount). The verification code is shown on screen instead of emailed.
2. Browses **Shop & Dine**, filters by empty tables or by zone, pays from the wallet, and
   gets a 6-digit code.
3. **Business** signs in with `hola@lamuralla.es`, opens **Confirm a code**, types the code.
   Confirming it is what completes the sale, releases the money and books the 8% commission.
4. A brand-new business (use any unused professional address) lands straight in the
   **AI assistant**, which asks seven short questions and then writes the bilingual profile,
   prices the offer against the category's discount band, warns if the margin is thin, and
   publishes. Then it offers to also publish an event and a job.

## Money rules, in one place

| | |
|---|---|
| Commission on every sale through the app | **8%** |
| Business premium (AI assistant + campaigns) | **€39 / month** |
| Event ticket platform fee | **€1.20 / ticket** |
| Job listing | **€25 / 30 days** |
| Student-to-student tutoring | **10% of the hour** |
| Student pays for the app | **nothing, ever** |

A business is only charged commission on a sale a student actually made *and* the till
confirmed. That is the whole argument of the pitch, so it is enforced in the data model:
a transaction starts `pending` and only `completed` counts.

## Layout

```
server.py            stdlib HTTP server: JSON API + static files
agora/db.py          schema and query helpers (SQLite)
agora/api.py         every endpoint, auth, money, the assistant conversation
agora/assistant.py   the assistant engine: copywriting, pricing, margin guardrails
agora/seed.py        demo Segovia businesses, offers, events, jobs, students
web/shared/          design system (inherited from the deck) + fetch wrapper
web/student/         the student app (mobile layout)
web/business/        the business console (desktop layout)
```

## The design language

Not a generic dashboard. The whole surface is built from four decisions:

- **Travertine, ink, bronze, oxblood.** Four values, used strictly. Bronze is the only
  metal and marks anything the house owns; **oxblood is reserved for price and nothing
  else**, so a student's eye finds the number without reading. Confirmations are the one
  green, used once.
- **Roman inscriptional display type** (Marcellus, cut from the capitals on Roman
  monuments) against the **native system face** for everything functional. Section labels
  are set as inscriptions — capitals, wide tracking, interpuncts: `I · SHOP·AND·DINE`.
  Sections are numbered in Roman numerals.
- **Hairlines, not boxes.** Lists are rules and whitespace. Almost no shadows, almost no
  rounded containers. Every card you remove makes the type do more work.
- **Drawn marks, no emoji.** `web/shared/icons.js` holds the set: an amphora for the
  table, an arched calendar for the agenda, a wax tablet for work, a portrait bust for the
  self, an oil lamp for the assistant, a colonnade for the numbers, a wax seal for a deal.
  The aqueduct arcade is drawn to width and used as a watermark on the pass and the gate —
  never as ornament for its own sake.

Interaction follows the platform rather than fighting it: 50px targets, `scale(.975)` on
press, sheets that travel on a single spring curve, skeletons instead of spinners, inline
field errors instead of toasts that fly past, the six-digit code auto-submitting when the
sixth digit lands, filters that remember what you chose, and a `prefers-reduced-motion`
block that turns all of it off.

The payment code is presented as a **pass**: ink, a perforation with punched notches, the
numerals in Marcellus, the aqueduct underneath. It should feel like something you hold up,
not a modal with a number in it.

## About the "AI" in the assistant

The assistant is **deterministic by design**. Pricing, discount bands, quiet-hour windows
and margin warnings are business rules, not prose — a language model should not be inventing
those, and the demo should not depend on a network call.

The copy generation is template-driven and bilingual. If you export `ANTHROPIC_API_KEY`,
`agora/assistant.py:llm_rewrite()` is the single seam where a real model call upgrades the
prose; everything else stays as it is.

## What is deliberately not built

- **No real payments.** The wallet is a number in SQLite. A real build needs a PSP and, since
  Ágora holds money between the student and the venue, a payment-institution agent agreement.
- **No real email.** Verification codes are returned by the API so you can click through.
- **No passwords.** Email + code only, which is what the product should do anyway.
- **Sessions never expire** and tokens live in `localStorage` (scoped per app, so you can
  be signed in as a student and as a house at the same time). Fine for a demo, not for
  production.
- The seeded businesses are fictional, written for this prototype.
