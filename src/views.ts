export function layout(title: string, body: string) {
  return `<!doctype html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          :root {
            --bg: #edf2fb;
            --panel: #fffdfd;
            --ink: #495567;
            --muted: #7d88a0;
            --line: #d7dfef;
            --accent: #907fc0;
            --accent-soft: #f3e6f2;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: var(--ink);
            background: linear-gradient(180deg, #faf7f1 0%, var(--bg) 100%);
            font-family: "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
          }
          a { color: inherit; }
          .app-shell { max-width: 1100px; margin: 0 auto; padding: 1rem; }
          .app-header, .page-head {
            display: flex;
            justify-content: space-between;
            align-items: end;
            gap: 1rem;
            margin-bottom: .75rem;
          }
          h1, h2 { margin: 0; font-family: "Hiragino Mincho ProN", "Yu Mincho", serif; }
          .card {
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: .75rem;
          }
          table { width: 100%; border-collapse: collapse; background: var(--panel); }
          th, td { border-bottom: 1px solid var(--line); padding: .45rem .5rem; text-align: left; }
          th { background: var(--accent-soft); }
          .muted { color: var(--muted); }
          .actions { display: flex; gap: .5rem; justify-content: flex-end; }
        </style>
      </head>
      <body>
        <main class="app-shell">${body}</main>
      </body>
    </html>`;
}
