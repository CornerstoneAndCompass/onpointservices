-- On Point Services Ltd - first-party analytics (Cloudflare D1)
--
-- Privacy-first by construction: an anonymous visitor id generated in the
-- browser, no raw IP (Cloudflare gives us country and region, the IP itself is
-- never read), no third-party cookies. Do-Not-Track is honoured client side.

-- Raw event stream. The only high-write table; every report aggregates from it.
CREATE TABLE IF NOT EXISTS events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       TEXT NOT NULL DEFAULT (datetime('now')),
  day      TEXT NOT NULL,              -- yyyy-mm-dd, for fast GROUP BY
  type     TEXT NOT NULL,              -- pageview | phone_click | email_click | enquiry_submit | quote_cta | social_click | outbound | scroll
  visitor  TEXT NOT NULL,              -- anonymous first-party id
  session  TEXT NOT NULL,              -- one visit
  path     TEXT,
  ref_host TEXT,                       -- referrer hostname
  source   TEXT,                       -- direct | search | social | referral | email | paid
  medium   TEXT,
  campaign TEXT,                       -- utm_campaign
  country  TEXT,                       -- 2-letter, from Cloudflare
  region   TEXT,                       -- e.g. Auckland
  device   TEXT,                       -- mobile | tablet | desktop
  dwell    INTEGER,                    -- engaged ms, pageviews only
  value    TEXT                        -- small JSON: { label, href, depth }
);

CREATE INDEX IF NOT EXISTS idx_events_day      ON events(day);
CREATE INDEX IF NOT EXISTS idx_events_ts       ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_day_type ON events(day, type);
CREATE INDEX IF NOT EXISTS idx_events_session  ON events(session);
CREATE INDEX IF NOT EXISTS idx_events_path     ON events(path);
CREATE INDEX IF NOT EXISTS idx_events_source   ON events(source);

-- One row per visit. Powers acquisition, the lead funnel, returning-visitor
-- counts and the live view without scanning the whole event stream.
CREATE TABLE IF NOT EXISTS visits (
  id         TEXT PRIMARY KEY,         -- session id
  visitor    TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen  TEXT NOT NULL DEFAULT (datetime('now')),
  day        TEXT NOT NULL,
  entry_path TEXT,
  last_path  TEXT,                     -- what they are looking at, for the live view
  ref_host   TEXT,
  source     TEXT,
  medium     TEXT,
  campaign   TEXT,
  country    TEXT,
  region     TEXT,
  device     TEXT,
  pageviews  INTEGER NOT NULL DEFAULT 0,
  max_scroll INTEGER NOT NULL DEFAULT 0,
  -- lead funnel flags: the whole point of the site
  called     INTEGER NOT NULL DEFAULT 0,
  emailed    INTEGER NOT NULL DEFAULT 0,
  enquired   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_visits_day       ON visits(day);
CREATE INDEX IF NOT EXISTS idx_visits_visitor   ON visits(visitor);
CREATE INDEX IF NOT EXISTS idx_visits_source    ON visits(source);
CREATE INDEX IF NOT EXISTS idx_visits_last_seen ON visits(last_seen);
