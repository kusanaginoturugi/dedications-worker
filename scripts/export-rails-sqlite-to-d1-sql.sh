#!/bin/sh
set -eu

usage() {
  cat >&2 <<'USAGE'
Usage:
  scripts/export-rails-sqlite-to-d1-sql.sh RAILS_SQLITE_DB [OUTPUT_SQL]

Example:
  scripts/export-rails-sqlite-to-d1-sql.sh \
    ../dedications/storage/production.sqlite3 \
    /tmp/dedications-d1-import.sql

The generated SQL replaces users, fellowships, events, and orders.
USAGE
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] || [ $# -lt 1 ] || [ $# -gt 2 ]; then
  usage
  exit 2
fi

src_db=$1
out=${2:-/tmp/dedications-d1-import.sql}

if [ ! -f "$src_db" ]; then
  echo "source SQLite DB not found: $src_db" >&2
  exit 1
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

sqlite3 "$src_db" > "$tmp" <<'SQL'
.headers off
.mode list

SELECT 'DELETE FROM orders;';
SELECT 'DELETE FROM events;';
SELECT 'DELETE FROM fellowships;';
SELECT 'DELETE FROM users;';

SELECT
  'INSERT INTO users (id, email, name, is_admin, created_at, updated_at) VALUES (' ||
  id || ', ' ||
  quote(email) || ', ' ||
  quote(COALESCE(NULLIF(name, ''), email)) || ', ' ||
  CASE WHEN is_admin THEN 1 ELSE 0 END || ', ' ||
  quote(created_at) || ', ' ||
  quote(updated_at) || ');'
FROM users
ORDER BY id;

SELECT
  'INSERT INTO events (id, name, is_active, created_at, updated_at) VALUES (' ||
  id || ', ' ||
  quote(name) || ', ' ||
  CASE WHEN is_active THEN 1 ELSE 0 END || ', ' ||
  quote(created_at) || ', ' ||
  quote(updated_at) || ');'
FROM events
ORDER BY id;

SELECT
  'INSERT INTO fellowships (id, code, old_code, name, enabled, created_at, updated_at) VALUES (' ||
  id || ', ' ||
  quote(code) || ', ' ||
  quote(old_code) || ', ' ||
  quote(name) || ', ' ||
  CASE WHEN enabled THEN 1 ELSE 0 END || ', ' ||
  quote(created_at) || ', ' ||
  quote(updated_at) || ');'
FROM fellowships
ORDER BY id;

SELECT
  'INSERT INTO orders (id, user_id, fellowship_id, event_id, form_type, page_number, fax_received_on, dedication_on, offerer_name, serial_number_start, serial_number_end, paid, created_at, updated_at) VALUES (' ||
  id || ', ' ||
  user_id || ', ' ||
  fellowship_id || ', ' ||
  COALESCE(CAST(event_id AS TEXT), 'NULL') || ', ' ||
  quote(form_type) || ', ' ||
  page_number || ', ' ||
  quote(fax_received_on) || ', ' ||
  quote(dedication_on) || ', ' ||
  quote(offerer_name) || ', ' ||
  COALESCE(CAST(serial_number_start AS TEXT), 'NULL') || ', ' ||
  COALESCE(CAST(serial_number_end AS TEXT), 'NULL') || ', ' ||
  CASE WHEN paid THEN 1 ELSE 0 END || ', ' ||
  quote(created_at) || ', ' ||
  quote(updated_at) || ');'
FROM orders
ORDER BY id;

SQL

mv "$tmp" "$out"
trap - EXIT

echo "$out"
