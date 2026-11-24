"""SQLite storage for Agora. Stdlib only."""
import sqlite3, os, secrets, time, json

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "agora.db")

SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  university TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  locale TEXT NOT NULL DEFAULT 'en',
  degree TEXT NOT NULL DEFAULT '',
  year INTEGER NOT NULL DEFAULT 0,
  wallet_cents INTEGER NOT NULL DEFAULT 0,
  saved_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  zone TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  description_es TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  premium INTEGER NOT NULL DEFAULT 0,
  profile_complete INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  lat REAL,
  lng REAL,
  real_name INTEGER NOT NULL DEFAULT 0,   -- a real Segovia business, shown with a demo notice
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  kind TEXT NOT NULL,                      -- percent | fixed | twofor | bundle
  -- Phase 1 is a leisure discounts app, so what you are buying is the primary
  -- axis and the shape of the discount is secondary. One vocabulary for offers
  -- and events alike: restaurants | products | club | football | theatre |
  -- cinema | play. See LEISURE in agora/leisure.py.
  leisure TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL,
  title_es TEXT NOT NULL,
  detail_en TEXT NOT NULL DEFAULT '',
  detail_es TEXT NOT NULL DEFAULT '',
  list_cents INTEGER NOT NULL,             -- normal price
  student_cents INTEGER NOT NULL,          -- price for a verified student
  stock INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  window_label TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  category TEXT NOT NULL,                  -- legacy, kept so old rows still read
  leisure TEXT NOT NULL DEFAULT '',        -- the phase-1 vocabulary; see leisure.py
  title_en TEXT NOT NULL,
  title_es TEXT NOT NULL,
  detail_en TEXT NOT NULL DEFAULT '',
  detail_es TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  list_cents INTEGER NOT NULL,
  student_cents INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  sold INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER REFERENCES businesses(id),
  student_id INTEGER REFERENCES students(id),   -- student-posted tutoring
  kind TEXT NOT NULL,                      -- job | tutoring
  title_en TEXT NOT NULL,
  title_es TEXT NOT NULL,
  detail_en TEXT NOT NULL DEFAULT '',
  detail_es TEXT NOT NULL DEFAULT '',
  hours_per_week REAL NOT NULL DEFAULT 0,
  pay_cents INTEGER NOT NULL,              -- per hour
  schedule TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',     -- sent | shortlisted | hired | declined
  created_at INTEGER NOT NULL,
  UNIQUE(job_id, student_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  ref_type TEXT NOT NULL,                  -- offer | event | job_fee
  ref_id INTEGER NOT NULL,
  list_cents INTEGER NOT NULL,
  paid_cents INTEGER NOT NULL,
  saved_cents INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | completed | cancelled
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,              -- student | business
  subject_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verifications (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  rating INTEGER NOT NULL,                 -- 1..5
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | published | rejected
  moderated_by TEXT NOT NULL DEFAULT '',
  moderated_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(business_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_review_status ON reviews(status, business_id);

CREATE TABLE IF NOT EXISTS assistant_state (
  business_id INTEGER PRIMARY KEY REFERENCES businesses(id),
  state TEXT NOT NULL DEFAULT '{}',
  draft TEXT NOT NULL DEFAULT '{}',
  messages TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_offer_active ON offers(active, business_id);
CREATE INDEX IF NOT EXISTS idx_event_active ON events(active, starts_at);
CREATE INDEX IF NOT EXISTS idx_job_active ON jobs(active, kind);
CREATE INDEX IF NOT EXISTS idx_tx_student ON transactions(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_business ON transactions(business_id, created_at);
"""


def connect():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


MIGRATIONS = [
    ("students", "invite_code", "TEXT"),
    ("students", "invited_by", "INTEGER"),
    ("students", "degree", "TEXT NOT NULL DEFAULT ''"),
    ("students", "year", "INTEGER NOT NULL DEFAULT 0"),
    ("businesses", "lat", "REAL"),
    ("businesses", "lng", "REAL"),
    ("businesses", "real_name", "INTEGER NOT NULL DEFAULT 0"),
    # Testers opened a pin and asked "open when?" before anything else. Opening
    # hours are part of the offer, not metadata about it.
    ("businesses", "hours", "TEXT NOT NULL DEFAULT ''"),
    ("offers", "leisure", "TEXT NOT NULL DEFAULT ''"),
    ("events", "leisure", "TEXT NOT NULL DEFAULT ''"),
]


POST_MIGRATION_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_offer_leisure ON offers(active, leisure)",
    "CREATE INDEX IF NOT EXISTS idx_event_leisure ON events(active, leisure)",
]


def init():
    conn = connect()
    conn.executescript(SCHEMA)
    for table, col, decl in MIGRATIONS:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(%s)" % table)]
        if col not in cols:
            conn.execute("ALTER TABLE %s ADD COLUMN %s %s" % (table, col, decl))
    conn.commit()
    # Indexes on migrated columns, once the columns are certain to exist.
    for stmt in POST_MIGRATION_INDEXES:
        conn.execute(stmt)
    conn.commit()
    # every student needs a code to share
    for r in conn.execute("SELECT id, name FROM students WHERE invite_code IS NULL").fetchall():
        conn.execute("UPDATE students SET invite_code=? WHERE id=?", (invite_for(r[1]), r[0]))
    conn.commit()
    conn.close()


def invite_for(name):
    base = "".join(c for c in (name or "AGORA").upper() if c.isalpha())[:4] or "AGORA"
    return base + "".join(secrets.choice("23456789") for _ in range(3))


def q(sql, args=(), one=False):
    conn = connect()
    try:
        cur = conn.execute(sql, args)
        rows = [dict(r) for r in cur.fetchall()]
        return (rows[0] if rows else None) if one else rows
    finally:
        conn.close()


def run(sql, args=()):
    conn = connect()
    try:
        cur = conn.execute(sql, args)
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def runmany(statements):
    """statements: list of (sql, args). Executed in one transaction."""
    conn = connect()
    try:
        last = None
        for sql, args in statements:
            last = conn.execute(sql, args).lastrowid
        conn.commit()
        return last
    finally:
        conn.close()


def now():
    return int(time.time())


def token():
    return secrets.token_urlsafe(24)


def code6():
    return "".join(secrets.choice("0123456789") for _ in range(6))


def jloads(v, default):
    try:
        return json.loads(v)
    except Exception:
        return default
