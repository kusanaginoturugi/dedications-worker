import { Hono } from "hono";
import type { Context } from "hono";
import { requireAdmin, requireUser } from "./auth";
import { formDefinitions, totalAmount, totalQuantity } from "./domain/orders";
import type { HonoEnv } from "./types";
import { layout } from "./views";

type OrderIndexRow = {
  id: number;
  page_number: number;
  form_type: string;
  offerer_name: string | null;
  serial_number_start: number | null;
  serial_number_end: number | null;
  paid: number;
  fellowship_name: string;
  user_name: string;
};

type OrderRow = {
  id: number;
  page_number: number;
  form_type: string;
  offerer_name: string | null;
  fellowship_id: number;
  fax_received_on: string | null;
  dedication_on: string | null;
  serial_number_start: number | null;
  serial_number_end: number | null;
  paid: number;
};

type FellowshipOption = {
  id: number;
  code: string;
  name: string;
};

type FellowshipRow = FellowshipOption & {
  old_code: string | null;
  enabled: number;
};

type MastersFellowshipRow = {
  id: number;
  code: string;
  old_code?: string | null;
  name: string;
};

type MastersFellowshipsResponse = {
  data: MastersFellowshipRow[];
  updated_at?: string;
};

type OrderInput = {
  pageNumber: number | null;
  formType: string;
  fellowshipId: number | null;
  faxReceivedOn: string | null;
  dedicationOn: string | null;
  offererName: string | null;
  serialNumberStart: number | null;
  serialNumberEnd: number | null;
  paid: boolean;
};

const app = new Hono<HonoEnv>();

app.get("/health", (c) => c.json({ ok: true, worker: "dedications-app" }));

app.use("*", requireUser);

app.get("/", (c) => c.redirect("/orders"));

app.get("/orders", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT
      orders.id,
      orders.page_number,
      orders.form_type,
      orders.offerer_name,
      orders.serial_number_start,
      orders.serial_number_end,
      orders.paid,
      fellowships.name AS fellowship_name,
      users.name AS user_name
    FROM orders
    JOIN fellowships ON fellowships.id = orders.fellowship_id
    JOIN users ON users.id = orders.user_id
    ORDER BY orders.page_number DESC`,
  ).all<OrderIndexRow>();

  const rows = results.map((order) => {
    const definition = formDefinitions[order.form_type as keyof typeof formDefinitions];
    const quantity = totalQuantity(order);
    const amount = totalAmount(order);
    return `<tr>
      <td>${order.page_number}</td>
      <td>${escapeHtml(definition?.plainLabel ?? order.form_type)}</td>
      <td>${escapeHtml(order.fellowship_name)}</td>
      <td>${escapeHtml(order.offerer_name ?? "")}</td>
      <td>${quantity ?? ""}</td>
      <td>${amount == null ? "" : amount.toLocaleString("ja-JP")}</td>
      <td>${order.paid ? "入金済" : "未入金"}</td>
      <td>${escapeHtml(order.user_name)}</td>
      <td><a href="/orders/${order.id}/edit">編集</a></td>
    </tr>`;
  }).join("");

  return c.html(layout("申込一覧", `<header class="page-head">
    <div>
      <h1>申込一覧</h1>
      <p class="muted">Rails 版からの移植中。まずは一覧の縦切り。</p>
    </div>
    <div class="actions">
      <a href="/orders/new">新規登録</a>
      <a href="/reports/proxy_inventory">帳票</a>
      <a href="/reports/proxy_inventory.pdf">PDF</a>
    </div>
  </header>
  <section class="card">
    <table>
      <thead>
        <tr>
          <th>番号</th><th>種類</th><th>伝道会</th><th>奉納者名</th>
          <th>本数</th><th>金額</th><th>入金</th><th>入力者</th><th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`));
});

app.get("/orders/new", async (c) => {
  const options = await fellowshipOptions(c.env.DB);
  return c.html(layout("申込登録", renderOrderForm({
    order: null,
    options,
    action: "/orders",
    submitLabel: "登録",
  })));
});

app.post("/orders", async (c) => {
  const input = await orderInputFromRequest(c);
  const errors = await validateOrderInput(c.env.DB, input);

  if (errors.length > 0) {
    const options = await fellowshipOptions(c.env.DB);
    return c.html(layout("申込登録", renderOrderForm({
      order: inputToOrderRow(input),
      options,
      action: "/orders",
      submitLabel: "登録",
      errors,
    })), 422);
  }

  const user = c.get("currentUser");
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO orders (
      user_id, fellowship_id, event_id, form_type, page_number, fax_received_on,
      dedication_on, offerer_name, serial_number_start, serial_number_end, paid,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      user.id,
      input.fellowshipId,
      await currentEventId(c.env.DB),
      input.formType,
      input.pageNumber,
      input.faxReceivedOn,
      input.dedicationOn,
      input.offererName,
      input.serialNumberStart,
      input.serialNumberEnd,
      input.paid ? 1 : 0,
      now,
      now,
    )
    .run();

  return c.redirect("/orders");
});

app.get("/orders/:id/edit", async (c) => {
  const order = await findOrder(c.env.DB, c.req.param("id"));
  if (!order) return c.text("Not Found", 404);

  const options = await fellowshipOptions(c.env.DB);
  return c.html(layout("申込編集", renderOrderForm({
    order,
    options,
    action: `/orders/${order.id}`,
    submitLabel: "更新",
  })));
});

app.post("/orders/:id", async (c) => {
  const order = await findOrder(c.env.DB, c.req.param("id"));
  if (!order) return c.text("Not Found", 404);

  const input = await orderInputFromRequest(c);
  const errors = await validateOrderInput(c.env.DB, input, order.id);

  if (errors.length > 0) {
    const options = await fellowshipOptions(c.env.DB);
    return c.html(layout("申込編集", renderOrderForm({
      order: { ...inputToOrderRow(input), id: order.id },
      options,
      action: `/orders/${order.id}`,
      submitLabel: "更新",
      errors,
    })), 422);
  }

  await c.env.DB.prepare(
    `UPDATE orders
     SET fellowship_id = ?,
         form_type = ?,
         page_number = ?,
         fax_received_on = ?,
         dedication_on = ?,
         offerer_name = ?,
         serial_number_start = ?,
         serial_number_end = ?,
         paid = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      input.fellowshipId,
      input.formType,
      input.pageNumber,
      input.faxReceivedOn,
      input.dedicationOn,
      input.offererName,
      input.serialNumberStart,
      input.serialNumberEnd,
      input.paid ? 1 : 0,
      new Date().toISOString(),
      order.id,
    )
    .run();

  return c.redirect("/orders");
});

app.post("/orders/:id/delete", async (c) => {
  const order = await findOrder(c.env.DB, c.req.param("id"));
  if (!order) return c.text("Not Found", 404);

  await c.env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(order.id).run();
  return c.redirect("/orders");
});

app.get("/fellowships", async (c) => {
  const query = c.req.query("query")?.trim() ?? "";

  if (wantsJson(c)) {
    return c.json(await searchFellowships(c.env.DB, query));
  }

  const { results } = await c.env.DB.prepare(
    "SELECT id, code, old_code, name, enabled FROM fellowships ORDER BY code, name",
  ).all<FellowshipRow>();

  return c.html(layout("伝道会", renderFellowshipsPage(results, query)));
});

app.post("/fellowships/enabled", requireAdmin, async (c) => {
  const body = await c.req.parseBody();
  const rawEnabled = Array.isArray(body.enabled) ? body.enabled : [body.enabled];
  const enabledIds = new Set<number>();
  for (const value of rawEnabled) {
    const id = parseInteger(value);
    if (id != null) enabledIds.add(id);
  }

  const { results } = await c.env.DB.prepare("SELECT id, enabled FROM fellowships").all<{
    id: number;
    enabled: number;
  }>();

  const statements = results.map((row) => {
    const enabled = enabledIds.has(row.id) ? 1 : 0;
    return c.env.DB.prepare(
      "UPDATE fellowships SET enabled = ?, updated_at = ? WHERE id = ? AND enabled != ?",
    ).bind(enabled, new Date().toISOString(), row.id, enabled);
  });

  if (statements.length > 0) {
    await c.env.DB.batch(statements);
  }

  return c.redirect("/fellowships");
});

app.post("/fellowships/sync", requireAdmin, async (c) => {
  try {
    const result = await syncFellowshipsFromMasters(c.env.DB, c.env.MASTERS_URL);
    return c.html(layout("伝道会同期", `<header class="page-head">
      <div>
        <h1>伝道会同期</h1>
        <p class="muted">マスタから ${result.count} 件を同期しました。</p>
      </div>
      <div class="actions"><a href="/fellowships">伝道会へ戻る</a></div>
    </header>
    <section class="card">
      <p>updated_at: ${escapeHtml(result.masterUpdatedAt ?? "")}</p>
    </section>`));
  } catch (error) {
    console.error("Fellowship sync failed", error);
    return c.html(layout("伝道会同期エラー", `<header class="page-head">
      <div>
        <h1>伝道会同期エラー</h1>
        <p class="muted">osystem-masters から取得できませんでした。</p>
      </div>
      <div class="actions"><a href="/fellowships">伝道会へ戻る</a></div>
    </header>
    <section class="card">
      <p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
    </section>`), 502);
  }
});

app.get("/reports/proxy_inventory", async (c) => {
  return c.html(layout("帳票: 代理・在庫", await renderProxyInventoryHtml(c.env.DB)));
});

app.get("/reports/proxy_inventory.pdf", async (c) => {
  const body = await renderProxyInventoryDocument(c.env.DB);
  let response: Response;
  try {
    response = await c.env.REPORT_RENDERER.fetch("https://report-renderer/render/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        title: "代理・在庫",
        html: body,
        pdfOptions: {
          format: "A4",
          printBackground: true,
          margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" },
        },
      }),
    });
  } catch (error) {
    console.error("PDF generation request failed", error);
    return c.text("PDF generation failed", 502);
  }

  if (!response.ok) return c.text("PDF generation failed", 502);
  return new Response(response.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="proxy_inventory.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});

app.get("/users", requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, email, name, is_admin FROM users ORDER BY name, email",
  ).all<{ id: number; email: string; name: string; is_admin: number }>();
  return c.json(results);
});

async function searchFellowships(db: D1Database, query: string): Promise<FellowshipOption[]> {
  const normalizedQuery = query.trim();
  const digits = normalizedQuery.replace(/\D/g, "");

  if (digits.length < 2 && normalizedQuery.length < 2) return [];

  if (digits.length >= 2 && normalizedQuery.length >= 2) {
    const { results } = await db.prepare(
      `SELECT id, code, name FROM fellowships
       WHERE code LIKE ? ESCAPE '\\'
          OR old_code LIKE ? ESCAPE '\\'
          OR name LIKE ? ESCAPE '\\'
       ORDER BY code, name
       LIMIT 20`,
    )
      .bind(`${escapeLike(digits)}%`, `${escapeLike(digits)}%`, `%${escapeLike(normalizedQuery)}%`)
      .all<FellowshipOption>();
    return results;
  }

  if (digits.length >= 2) {
    const { results } = await db.prepare(
      `SELECT id, code, name FROM fellowships
       WHERE code LIKE ? ESCAPE '\\'
          OR old_code LIKE ? ESCAPE '\\'
       ORDER BY code, name
       LIMIT 20`,
    )
      .bind(`${escapeLike(digits)}%`, `${escapeLike(digits)}%`)
      .all<FellowshipOption>();
    return results;
  }

  const { results } = await db.prepare(
    `SELECT id, code, name FROM fellowships
     WHERE name LIKE ? ESCAPE '\\'
     ORDER BY code, name
     LIMIT 20`,
  )
    .bind(`%${escapeLike(normalizedQuery)}%`)
    .all<FellowshipOption>();
  return results;
}

function renderFellowshipsPage(rows: FellowshipRow[], query: string): string {
  const enabledCount = rows.filter((row) => row.enabled === 1).length;
  const body = rows.map((row) => `<tr>
    <td><input type="checkbox" name="enabled" value="${row.id}"${row.enabled === 1 ? " checked" : ""}></td>
    <td>${escapeHtml(row.code)}</td>
    <td>${escapeHtml(row.old_code ?? "")}</td>
    <td>${escapeHtml(row.name)}</td>
  </tr>`).join("");

  return `<header class="page-head">
    <div>
      <h1>伝道会</h1>
      <p class="muted">有効 ${enabledCount} / 全 ${rows.length}</p>
    </div>
    <div class="actions"><a href="/orders">申込一覧</a></div>
  </header>
  <section class="card">
    <form method="post" action="/fellowships/sync">
      <button type="submit">マスタから同期</button>
    </form>
  </section>
  <section class="card">
    <form method="get" action="/fellowships">
      <label>検索
        <input name="query" value="${escapeAttr(query)}" placeholder="コードまたは名称">
      </label>
      <button type="submit">検索</button>
    </form>
  </section>
  <form method="post" action="/fellowships/enabled" class="card">
    <table>
      <thead>
        <tr><th>対象</th><th>コード</th><th>旧コード</th><th>名称</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <p><button type="submit">対象伝道会を更新</button></p>
  </form>`;
}

async function syncFellowshipsFromMasters(
  db: D1Database,
  mastersUrl: string | undefined,
): Promise<{ count: number; masterUpdatedAt?: string }> {
  const baseUrl = (mastersUrl?.trim() || "https://osystem-masters.kusanaginoturugi.workers.dev")
    .replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/api/fellowships`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`masters /api/fellowships returned ${response.status}`);
  }

  const body = await response.json<MastersFellowshipsResponse>();
  if (!Array.isArray(body.data)) {
    throw new Error("masters /api/fellowships returned invalid data");
  }

  const now = new Date().toISOString();
  const statements = body.data.map((row) => {
    if (!Number.isInteger(row.id) || !row.code || !row.name) {
      throw new Error("masters fellowship row is missing id/code/name");
    }
    return db.prepare(
      `INSERT INTO fellowships (id, code, old_code, name, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code,
         old_code = excluded.old_code,
         name = excluded.name,
         updated_at = excluded.updated_at`,
    ).bind(row.id, row.code, row.old_code ?? null, row.name, now, now);
  });

  if (statements.length > 0) {
    await db.batch(statements);
  }

  return { count: body.data.length, masterUpdatedAt: body.updated_at };
}

async function fellowshipOptions(db: D1Database): Promise<FellowshipOption[]> {
  const { results } = await db.prepare(
    "SELECT id, code, name FROM fellowships WHERE enabled = 1 ORDER BY code, name",
  ).all<FellowshipOption>();
  return results;
}

async function findOrder(db: D1Database, id: string): Promise<OrderRow | null> {
  const orderId = parseInteger(id);
  if (orderId == null) return null;
  return db.prepare(
    `SELECT id, page_number, form_type, offerer_name, fellowship_id, fax_received_on,
            dedication_on, serial_number_start, serial_number_end, paid
     FROM orders
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(orderId)
    .first<OrderRow>();
}

async function currentEventId(db: D1Database): Promise<number | null> {
  const row = await db.prepare(
    `SELECT id
     FROM events
     ORDER BY is_active DESC, created_at DESC
     LIMIT 1`,
  ).first<{ id: number }>();
  return row?.id ?? null;
}

async function orderInputFromRequest(c: Context<HonoEnv>): Promise<OrderInput> {
  const body = await c.req.parseBody();
  return {
    pageNumber: parseInteger(body.page_number),
    formType: String(body.form_type ?? "").trim(),
    fellowshipId: parseInteger(body.fellowship_id),
    faxReceivedOn: cleanDate(body.fax_received_on),
    dedicationOn: cleanDate(body.dedication_on),
    offererName: cleanString(body.offerer_name),
    serialNumberStart: parseInteger(body.serial_number_start),
    serialNumberEnd: parseInteger(body.serial_number_end),
    paid: body.paid === "1",
  };
}

async function validateOrderInput(
  db: D1Database,
  input: OrderInput,
  currentOrderId: number | null = null,
): Promise<string[]> {
  const errors: string[] = [];

  if (input.pageNumber == null || input.pageNumber <= 0) {
    errors.push("ページ番号は1以上の整数で入力してください。");
  }
  if (!(input.formType in formDefinitions)) {
    errors.push("申込書の種類を選択してください。");
  }
  if (input.fellowshipId == null) {
    errors.push("伝道会を選択してください。");
  }
  if (
    input.serialNumberStart != null
    && input.serialNumberEnd != null
    && input.serialNumberEnd < input.serialNumberStart
  ) {
    errors.push("通し番号(終了)は通し番号(開始)以上にしてください。");
  }

  if (input.formType && input.pageNumber != null) {
    const duplicate = await db.prepare(
      `SELECT id FROM orders
       WHERE form_type = ? AND page_number = ? AND (? IS NULL OR id != ?)
       LIMIT 1`,
    )
      .bind(input.formType, input.pageNumber, currentOrderId, currentOrderId)
      .first<{ id: number }>();
    if (duplicate) errors.push("ページ番号は同じ申込書種類ですでに使われています。");
  }

  if (
    input.formType
    && input.serialNumberStart != null
    && input.serialNumberEnd != null
  ) {
    const overlap = await db.prepare(
      `SELECT id FROM orders
       WHERE form_type = ?
         AND serial_number_start <= ?
         AND serial_number_end >= ?
         AND (? IS NULL OR id != ?)
       LIMIT 1`,
    )
      .bind(
        input.formType,
        input.serialNumberEnd,
        input.serialNumberStart,
        currentOrderId,
        currentOrderId,
      )
      .first<{ id: number }>();
    if (overlap) errors.push("通し番号は同じ申込書種類ですでに使われています。");
  }

  return errors;
}

function renderOrderForm(params: {
  order: OrderRow | null;
  options: FellowshipOption[];
  action: string;
  submitLabel: string;
  errors?: string[];
}): string {
  const order = params.order;
  const formOptions = Object.entries(formDefinitions).map(([value, definition]) => (
    `<option value="${escapeAttr(value)}"${order?.form_type === value ? " selected" : ""}>${escapeHtml(definition.plainLabel)}</option>`
  )).join("");
  const fellowshipOptionsHtml = params.options.map((option) => (
    `<option value="${option.id}"${order?.fellowship_id === option.id ? " selected" : ""}>${escapeHtml(`${option.code} ${option.name}`)}</option>`
  )).join("");
  const errors = params.errors?.length
    ? `<div class="card"><ul>${params.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>`
    : "";

  return `<header class="page-head">
    <div>
      <h1>${escapeHtml(params.submitLabel === "登録" ? "申込登録" : "申込編集")}</h1>
      <p class="muted">まずは移植用の最小フォーム。</p>
    </div>
    <div class="actions"><a href="/orders">一覧へ戻る</a></div>
  </header>
  ${errors}
  <form class="card" method="post" action="${escapeAttr(params.action)}">
    <p>
      <label>ページ番号<br>
        <input name="page_number" inputmode="numeric" required value="${escapeAttr(order?.page_number ?? "")}">
      </label>
    </p>
    <p>
      <label>申込書種類<br>
        <select name="form_type" required>${formOptions}</select>
      </label>
    </p>
    <p>
      <label>伝道会<br>
        <select name="fellowship_id" required>${fellowshipOptionsHtml}</select>
      </label>
    </p>
    <p>
      <label>奉納者名<br>
        <input name="offerer_name" value="${escapeAttr(order?.offerer_name ?? "")}">
      </label>
    </p>
    <p>
      <label>FAX受信日<br>
        <input type="date" name="fax_received_on" value="${escapeAttr(order?.fax_received_on ?? today())}">
      </label>
    </p>
    <p>
      <label>奉納日<br>
        <input type="date" name="dedication_on" value="${escapeAttr(order?.dedication_on ?? today())}">
      </label>
    </p>
    <p>
      <label>通し番号(開始)<br>
        <input name="serial_number_start" inputmode="numeric" value="${escapeAttr(order?.serial_number_start ?? "")}">
      </label>
    </p>
    <p>
      <label>通し番号(終了)<br>
        <input name="serial_number_end" inputmode="numeric" value="${escapeAttr(order?.serial_number_end ?? "")}">
      </label>
    </p>
    <p>
      <label>
        <input type="checkbox" name="paid" value="1"${order?.paid ? " checked" : ""}>
        入金済み
      </label>
    </p>
    <p><button type="submit">${escapeHtml(params.submitLabel)}</button></p>
  </form>
  ${order?.id ? `<form method="post" action="/orders/${order.id}/delete"><button type="submit">削除</button></form>` : ""}`;
}

function inputToOrderRow(input: OrderInput): OrderRow {
  return {
    id: 0,
    page_number: input.pageNumber ?? 0,
    form_type: input.formType,
    offerer_name: input.offererName,
    fellowship_id: input.fellowshipId ?? 0,
    fax_received_on: input.faxReceivedOn,
    dedication_on: input.dedicationOn,
    serial_number_start: input.serialNumberStart,
    serial_number_end: input.serialNumberEnd,
    paid: input.paid ? 1 : 0,
  };
}

async function renderProxyInventoryHtml(db: D1Database): Promise<string> {
  return `<header class="page-head">
    <div>
      <h1>帳票: 代理・在庫</h1>
      <p class="muted">代理奉納入力データから集計します。</p>
    </div>
  </header>
  <section class="card">
    ${await renderProxyInventoryTable(db)}
  </section>`;
}

async function renderProxyInventoryDocument(db: D1Database): Promise<string> {
  const table = await renderProxyInventoryTable(db);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <style>
    body {
      color: #1f2937;
      font-family: "Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif;
      font-size: 12px;
    }
    h1 { margin: 0 0 10px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #d7dfef; padding: 7px 6px; }
    th { background: #f3e6f2; text-align: left; }
    td.number, th.number { text-align: right; }
  </style>
</head>
<body>
  <h1>帳票: 代理・在庫</h1>
  ${table}
</body>
</html>`;
}

async function renderProxyInventoryTable(db: D1Database): Promise<string> {
  const rows = await Promise.all(Object.entries(formDefinitions).map(async ([formType, definition]) => {
    const result = await db.prepare(
      `SELECT serial_number_start, serial_number_end
       FROM orders
       WHERE form_type = ?`,
    )
      .bind(formType)
      .all<{ serial_number_start: number | null; serial_number_end: number | null }>();
    const quantity = result.results.reduce((sum, row) => sum + (totalQuantity(row) ?? 0), 0);
    const sales = quantity * definition.unitPrice;
    const seiinAmount = quantity * definition.refundUnit;
    const mirokuAmount = quantity * definition.mirokuUnit;
    return { definition, quantity, sales, seiinAmount, mirokuAmount };
  }));

  const totals = rows.reduce((acc, row) => ({
    quantity: acc.quantity + row.quantity,
    sales: acc.sales + row.sales,
    seiinAmount: acc.seiinAmount + row.seiinAmount,
    mirokuAmount: acc.mirokuAmount + row.mirokuAmount,
  }), { quantity: 0, sales: 0, seiinAmount: 0, mirokuAmount: 0 });

  const body = rows.map((row) => `<tr>
    <td>${row.definition.reportLabel.replaceAll("\n", "<br>")}</td>
    <td class="number">${row.definition.unitPrice.toLocaleString("ja-JP")}</td>
    <td class="number">${row.quantity.toLocaleString("ja-JP")}</td>
    <td class="number">${row.sales.toLocaleString("ja-JP")}</td>
    <td class="number">${row.definition.refundUnit.toLocaleString("ja-JP")}</td>
    <td class="number">${row.seiinAmount.toLocaleString("ja-JP")}</td>
    <td class="number">${row.definition.mirokuUnit.toLocaleString("ja-JP")}</td>
    <td class="number">${row.mirokuAmount.toLocaleString("ja-JP")}</td>
  </tr>`).join("");

  return `<table>
    <thead>
      <tr>
        <th>道具名</th>
        <th class="number">奉納料</th>
        <th class="number">奉納数</th>
        <th class="number">売上</th>
        <th class="number">還付金</th>
        <th class="number">聖院還付分</th>
        <th class="number">弥勒寺</th>
        <th class="number">弥勒寺入金分</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
    <tfoot>
      <tr>
        <th>合計</th>
        <th class="number">-</th>
        <th class="number">${totals.quantity.toLocaleString("ja-JP")}</th>
        <th class="number">${totals.sales.toLocaleString("ja-JP")}</th>
        <th class="number">-</th>
        <th class="number">${totals.seiinAmount.toLocaleString("ja-JP")}</th>
        <th class="number">-</th>
        <th class="number">${totals.mirokuAmount.toLocaleString("ja-JP")}</th>
      </tr>
    </tfoot>
  </table>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}

function parseInteger(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  return Number.parseInt(text, 10);
}

function cleanString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function cleanDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function wantsJson(c: Context<HonoEnv>): boolean {
  const format = c.req.query("format");
  const accept = c.req.header("accept") ?? "";
  return format === "json" || accept.includes("application/json");
}

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

export default app;
