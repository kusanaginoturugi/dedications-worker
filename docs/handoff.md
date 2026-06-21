# 引き継ぎ

## 現在地

新規 repo に Workers 移植の骨組みを作った段階。
依存 install と typecheck は完了。
D1 `dedications` は作成済みで、初期 migration は local / remote とも適用済み。
local / remote D1 には本番 SQLite 由来のデータを import 済み。

## 主要ファイル

- `wrangler.jsonc`: app Worker 設定
- `report-renderer/wrangler.jsonc`: PDF renderer Worker 設定
- `migrations/0001_initial.sql`: D1 初期 schema
- `src/index.ts`: Hono app
- `src/auth.ts`: authentik ヘッダ認証
- `src/domain/orders.ts`: Rails `Order::FORM_DEFINITIONS` 移植
- `report-renderer/src/index.ts`: HTML to PDF

## 次にやること

1. renderer Worker の PDF 生成を本番で確認
2. authentik / Cloudflare Access の本番ヘッダ仕様を確定
3. Rails 版の入力フォーム UX に寄せる
4. CSV 帳票を実装
5. Worker deploy と本番 smoke test

## 注意

- 現行 Rails repo `/home/onoue/src/osystem/dedications` は参照だけ。まだ触らない。
- renderer Worker は D1 を持たない。app から HTML を受け取って PDF にするだけ。
- local PDF 確認では Browser Run の Chrome ダウンロードが詰まった。`/home/onoue/.cache/.wrangler/chrome` を消すか、ネットワークが安定した状態で再実行する。
- PDF は本番で確認する方針。
- `seeds/dev.sql` は master ID 前提。`npm run db:seed:local` は全 fellowship を一度 disabled にして、サンプル2件だけ enabled に戻す。
- `scripts/export-rails-sqlite-to-d1-sql.sh` は本番 SQLite 実データで local D1 import 済み。
- local D1 は現在、本番 SQLite 由来のデータが入っている。開発 seed に戻すなら `npm run db:seed:local`。
- remote D1 には本番 SQLite 由来のデータを import 済み。
- remote D1 件数: users 2, fellowships 93, events 0, orders 251。orders 参照切れ 0。
- D1 remote import 用 SQL には `BEGIN TRANSACTION` / `COMMIT` を含めない。
- `users.password_digest` は移行しない前提。
