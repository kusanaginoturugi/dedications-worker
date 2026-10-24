# 作業記録

## 2026-06-21

- `dedications-worker` の初期構成を作成。
- Hono 本体 Worker `dedications-app` を追加。
- D1 初期 migration `migrations/0001_initial.sql` を追加。
- authentik ヘッダ前提の `requireUser` / `requireAdmin` middleware を追加。
- `orders` 一覧の最小表示を追加。
- `proxy_inventory` 帳票の HTML と PDF 呼び出し口を追加。
- Browser Run PDF 用 Worker `dedications-report-renderer` を追加。
- 移植計画、作業記録、引き継ぎを docs に保存。
- `npm install` を実行。`sharp` の native build 対応で `node-addon-api` と `node-gyp` を devDependency に追加。
- `npm run typecheck` が通ることを確認。
- D1 `dedications` を Cloudflare に作成し、`wrangler.jsonc` に `database_id` を反映。
- 初期 migration を local / remote D1 に適用。
- 開発用 seed `seeds/dev.sql` を追加し、local D1 に投入。
- `wrangler types` を実行。生成された runtime types を使う形に更新。
- local dev server で `GET /orders` を確認。auth ヘッダありは `200`、なしは `401`。
- local dev server で `GET /reports/proxy_inventory` を確認。
- `orders` の最小 CRUD を実装。
- local dev server で `GET /orders/new`, `POST /orders`, `GET /orders/:id/edit`, `POST /orders/:id`, `POST /orders/:id/delete` を確認。
- `page_number + form_type` 重複 validation が `422` を返すことを確認。
- `fellowships` の JSON 検索と HTML 管理画面を実装。
- `POST /fellowships/enabled` で enabled の一括更新を実装。
- local dev server で `GET /fellowships?format=json&query=10`, `GET /fellowships`, `POST /fellowships/enabled` を確認。
- PDF renderer Worker と app Worker を local 起動し、`REPORT_RENDERER` service binding が `[connected]` になることを確認。
- local PDF 生成は Browser Run の Chrome 再ダウンロードで長時間進まなかったため中断。
- app 側の PDF renderer 呼び出しに 30 秒 timeout を追加。
- `MASTERS_URL` を Worker vars に追加。
- `POST /fellowships/sync` を実装。osystem-masters の `/api/fellowships` から `id/code/old_code/name` を upsert し、`enabled` は触らない。
- local dev server で `POST /fellowships/sync` を確認。94 件同期、`updated_at: 2026-06-09 07:23:03`。
- dev seed を master ID 前提に修正し、同期後でも sample order が正しい fellowship を参照するようにした。
- Rails SQLite から D1 import SQL を生成する `scripts/export-rails-sqlite-to-d1-sql.sh` を追加。
- `/tmp` に Rails SQLite 互換 fixture DB を作成し、export SQL 生成と local D1 import を確認。
- import 検証後、`npm run db:seed:local` で local D1 を開発 seed 状態に戻した。
- `/home/onoue/src/osystem/dedications/storage/production.sqlite3` の実データで D1 import SQL を生成。
- 実データを local D1 に import し、件数一致を確認: users 2, fellowships 93, events 0, orders 251。
- local D1 で orders の user/fellowship 参照切れが 0 件であることを確認。
- local app で本番データの `GET /orders` と `GET /reports/proxy_inventory` が 200 を返すことを確認。
- D1 remote import が `BEGIN TRANSACTION` を受け付けないため、生成 SQL から `BEGIN TRANSACTION` / `COMMIT` を削除。
- `/tmp/dedications-production-d1-import.sql` を remote D1 に import。
- remote D1 の件数一致を確認: users 2, fellowships 93, events 0, orders 251。
- remote D1 で orders の user/fellowship 参照切れが 0 件であることを確認。

## 2026-10-24 セキュリティ点検

[www の共通手順](https://github.com/kusanaginoturugi/www/blob/main/docs/security-runbook.md) に沿って点検した。どちらの Worker も Cloudflare には未デプロイ (`wrangler deployments list` が `Worker does not exist`、workers.dev は 404) なので、外部から悪用された可能性はない。

- 認証: `requireUser` が `x-authentik-email` / `x-authentik-groups` をそのまま信用していた。Worker の URL に直接リクエストすれば、ヘッダを付けるだけで任意の利用者・管理者になれる。前段のプロキシが送る `x-auth-proxy-secret` が secret `AUTH_PROXY_SECRET` と一致したときだけヘッダを信用するようにした。secret が未設定なら 503 で拒否する。Cloudflare Access にする場合は、この確認を `Cf-Access-Jwt-Assertion` の JWT 検証に置き換える。
- 公開 URL: 両 Worker に `workers_dev: false` / `preview_urls: false` を設定。renderer は service binding からだけ呼ばれる。公開されると誰でも任意の HTML を Browser Run で PDF にできてしまう。
- CSRF: 前段のプロキシのセッション Cookie で他サイトから POST されるのを防ぐため、`hono/csrf` で Origin を確認する。
- ヘッダ: `hono/secure-headers` で CSP (`script-src 'none'`、`style-src` は layout の `<style>` のため `'unsafe-inline'`)、`Permissions-Policy` などを付ける。
- HTML 出力は `escapeHtml` / `escapeAttr` でエスケープ済み。fellowships の同期先は vars の固定 URL。
- npm audit (更新前): 16 件 (critical 1、high 14、moderate 1)。hono 4.12.26 → 4.13.13、@cloudflare/puppeteer 1.1.0 → 1.4.0、wrangler 4.103.0 → 4.152.0、`npm audit fix` で 10 件。
  - 残り (production): basic-ftp と extract-zip (high)。@cloudflare/puppeteer → @puppeteer/browsers の依存で、Node でブラウザを取得するときだけ使う。`wrangler deploy --dry-run` のバンドル (source map) に含まれないことを確認した。extract-zip は修正版がなく、basic-ftp の修正版は get-uri 6 の範囲外。CI はこの2つの advisory だけ除外し、バンドルに入っていないことも確認する。@cloudflare/puppeteer が @puppeteer/browsers の依存を外すか、修正版が範囲に入ったら除外をやめる。
  - 残り (dev): wrangler → miniflare → undici 7.29.1 (修正は 7.30.1)。ローカル開発だけで使う。wrangler の更新で解消する。
- GitHub: CI (typecheck、両 Worker の dry-run build、npm audit、週次実行)、CodeQL (actions / javascript-typescript)、Dependency Review、Dependabot (npm / github-actions、週次) を追加。Dependabot alerts を有効化。
- 検証: `wrangler dev` で、ヘッダだけ → 401、secret 違い → 401、secret 一致 → 200、secret 未設定 → 503、他オリジンからの POST → 403、同一オリジンの POST → 通過、レスポンスに CSP 等が付くことを確認。
