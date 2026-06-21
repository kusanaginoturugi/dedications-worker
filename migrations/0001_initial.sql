PRAGMA foreign_keys = ON;

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  name TEXT,
  is_active INTEGER CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE fellowships (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  old_code TEXT,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX index_fellowships_on_code ON fellowships (code);
CREATE INDEX index_fellowships_on_old_code ON fellowships (old_code);
CREATE INDEX index_fellowships_on_name ON fellowships (name);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX index_users_on_email ON users (email);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  fellowship_id INTEGER NOT NULL REFERENCES fellowships (id) ON DELETE RESTRICT,
  event_id INTEGER REFERENCES events (id) ON DELETE SET NULL,
  form_type TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  fax_received_on TEXT,
  dedication_on TEXT,
  offerer_name TEXT,
  serial_number_start INTEGER,
  serial_number_end INTEGER,
  paid INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (page_number > 0),
  CHECK (
    serial_number_start IS NULL
    OR serial_number_end IS NULL
    OR serial_number_end >= serial_number_start
  )
) STRICT;

CREATE INDEX index_orders_on_user_id ON orders (user_id);
CREATE INDEX index_orders_on_fellowship_id ON orders (fellowship_id);
CREATE INDEX index_orders_on_event_id ON orders (event_id);
CREATE INDEX index_orders_on_fellowship_id_and_page_number ON orders (fellowship_id, page_number);
CREATE UNIQUE INDEX index_orders_on_form_type_and_page_number ON orders (form_type, page_number);
