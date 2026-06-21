# 移植計画

## 目的

Rails 版 `kusanaginoturugi/dedications` を、Cloudflare Workers / Hono / D1 に移植する。
本番切替までは Rails 版を維持し、新規 repo `dedications-worker` で並行開発する。

## Repo 方針

- 現行 Rails: `kusanaginoturugi/dedications`
- 新規 Workers: `kusanaginoturugi/dedications-worker`
- 切替後は Rails repo を `dedications-rails` に rename または archive
- 必要なら Workers repo を `dedications` に rename

## Architecture

- `dedications-app`
  - Hono 本体
  - D1 CRUD
  - HTML 画面
  - CSV 出力
  - 認証ヘッダから current user を解決
- `dedications-report-renderer`
  - Browser Run / `@cloudflare/puppeteer`
  - app から渡された HTML を PDF 化
  - D1 には触らない

## 認証

authentik または Cloudflare Access を前段に置く。
アプリはパスワードを持たず、認証済みヘッダの email を `users.email` と照合する。

初期方針:

- 未登録 email は `403`
- `users.is_admin = 1` または `ADMIN_GROUP` で admin 判定
- Rails の `password_digest` は移行しない

## D1 移行

Rails の `db/schema.rb` から初期 migration を作成済み。
Rails SQLite から D1 へのデータ移行は `scripts/export-rails-sqlite-to-d1-sql.sh` で
import SQL を生成する。

注意点:

- boolean は `INTEGER 0/1`
- date/datetime は ISO 文字列の `TEXT`
- `orders(form_type, page_number)` unique は維持
- serial number overlap はアプリ側 validation で実装する
- `users.password_digest` は捨てる

## 実装順

1. Hono + D1 skeleton
2. authentik / Access ヘッダから `currentUser`
3. `orders` 一覧
4. `orders` CRUD
5. `fellowships` 検索・同期
6. 集計 HTML
7. CSV
8. Browser Run PDF
9. Rails SQLite から D1 へのデータ移行
10. staging 検証
11. 本番切替

## PDF 方針

Prawn は移植しない。
帳票 HTML を app Worker で作り、renderer Worker に渡して `page.pdf()` で PDF 化する。

この形にすると renderer は D1 権限を持たず、PDF 生成だけに閉じられる。

## 未決定

- Cloudflare Access 経由にするか、authentik outpost のヘッダを直接信頼するか
- `users` の初期登録方法
- CSV を UTF-8 に寄せるか、Shift_JIS を維持するか
- `MasterSync` の接続先と同期タイミング
