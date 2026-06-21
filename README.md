# dedications-worker

FAX で届く護摩供申込書を入力・集計する `dedications` Rails アプリの
Cloudflare Workers 移植版。

## 方針

- App: Cloudflare Workers + Hono
- DB: Cloudflare D1
- PDF: Cloudflare Browser Run (`@cloudflare/puppeteer`) で HTML から生成
- Auth: authentik / Cloudflare Access 前提。アプリ内パスワード認証は持たない

## 構成

- `src/`: Hono 本体 Worker
- `report-renderer/`: Browser Run で PDF を生成する Worker
- `migrations/`: D1 migration
- `docs/migration-plan.md`: 移植計画
- `docs/worklog.md`: 作業記録
- `docs/handoff.md`: 引き継ぎ

## 開発

```sh
npm install
npm run cf-typegen
npm run db:migrate:local
npm run db:seed:local
npm run typecheck
npm run dev
```

PDF renderer は別 Worker として動かす。

```sh
npm run dev:report
```

`wrangler.jsonc` の `database_id` は D1 作成後に差し替える。

## 認証ヘッダ

既定では次の authentik ヘッダを見る。

- `x-authentik-email`
- `x-authentik-name`
- `x-authentik-groups`

`users.email` に一致するユーザーがいない場合は `403`。
`users.is_admin = 1` または `ADMIN_GROUP` に含まれる group がある場合だけ admin。

## Rails SQLite から D1 へ移行

Rails 側の SQLite から D1 import 用 SQL を生成する。

```sh
scripts/export-rails-sqlite-to-d1-sql.sh \
  ../dedications/storage/production.sqlite3 \
  /tmp/dedications-d1-import.sql
```

local D1 で確認する。

```sh
npm run db:import:local -- /tmp/dedications-d1-import.sql
```

本番 D1 に投入する。

```sh
npm run db:import:remote -- /tmp/dedications-d1-import.sql
```

生成 SQL は `users`, `fellowships`, `events`, `orders` を削除してから再投入する。
Cloudflare D1 remote import で弾かれるため、生成 SQL には `BEGIN TRANSACTION` / `COMMIT` を含めない。
`users.password_digest` は移行しない。
