INSERT OR IGNORE INTO users (id, email, name, is_admin, created_at, updated_at)
VALUES
  (1, 'admin@example.com', '開発管理者', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO events (id, name, is_active, created_at, updated_at)
VALUES
  (1, '開発用行事', 1, datetime('now'), datetime('now'));

UPDATE fellowships
SET enabled = 0,
    updated_at = datetime('now');

INSERT INTO fellowships (id, code, old_code, name, enabled, created_at, updated_at)
VALUES
  (3, '10121', NULL, '江別準総壇', 1, datetime('now'), datetime('now')),
  (7, '20201', NULL, '青森伝道会', 1, datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  code = excluded.code,
  old_code = excluded.old_code,
  name = excluded.name,
  enabled = excluded.enabled,
  updated_at = excluded.updated_at;

INSERT INTO orders (
  id,
  user_id,
  fellowship_id,
  event_id,
  form_type,
  page_number,
  fax_received_on,
  dedication_on,
  offerer_name,
  serial_number_start,
  serial_number_end,
  paid,
  created_at,
  updated_at
)
VALUES
  (
    1,
    1,
    3,
    1,
    'wish_fulfillment_staff',
    1,
    date('now'),
    date('now'),
    '開発 太郎',
    1001,
    1010,
    1,
    datetime('now'),
    datetime('now')
  ),
  (
    2,
    1,
    7,
    1,
    'sanki_reiboku',
    2,
    date('now'),
    date('now'),
    '開発 花子',
    2001,
    2005,
    0,
    datetime('now'),
    datetime('now')
  )
ON CONFLICT(id) DO UPDATE SET
  user_id = excluded.user_id,
  fellowship_id = excluded.fellowship_id,
  event_id = excluded.event_id,
  form_type = excluded.form_type,
  page_number = excluded.page_number,
  fax_received_on = excluded.fax_received_on,
  dedication_on = excluded.dedication_on,
  offerer_name = excluded.offerer_name,
  serial_number_start = excluded.serial_number_start,
  serial_number_end = excluded.serial_number_end,
  paid = excluded.paid,
  updated_at = excluded.updated_at;
