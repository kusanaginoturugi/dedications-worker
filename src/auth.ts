import type { MiddlewareHandler } from "hono";
import type { HonoEnv } from "./types";

type UserRow = {
  id: number;
  email: string;
  name: string;
  is_admin: number;
};

function headerName(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function parseGroups(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((group) => group.trim())
    .filter(Boolean);
}

async function sameSecret(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  // timingSafeEqual は Workers 独自の API で、DOM の型には含まれない
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean;
  };
  return subtle.timingSafeEqual(a, b);
}

export const requireUser: MiddlewareHandler<HonoEnv> = async (c, next) => {
  // 認証ヘッダは誰でも付けられるので、前段のプロキシだけが知る secret が一致したときだけ信用する
  const proxySecret = c.env.AUTH_PROXY_SECRET?.trim();
  if (!proxySecret) return c.text("Authentication is not configured", 503);
  const secretHeader = headerName(c.env.AUTH_PROXY_SECRET_HEADER, "x-auth-proxy-secret");
  if (!(await sameSecret(c.req.header(secretHeader) ?? "", proxySecret))) {
    return c.text("Unauthorized", 401);
  }

  const emailHeader = headerName(c.env.AUTH_EMAIL_HEADER, "x-authentik-email");
  const nameHeader = headerName(c.env.AUTH_NAME_HEADER, "x-authentik-name");
  const groupsHeader = headerName(c.env.AUTH_GROUPS_HEADER, "x-authentik-groups");

  const email = c.req.header(emailHeader)?.trim().toLowerCase();
  if (!email) return c.text("Unauthorized", 401);

  const row = await c.env.DB.prepare(
    "SELECT id, email, name, is_admin FROM users WHERE email = ? LIMIT 1",
  )
    .bind(email)
    .first<UserRow>();

  if (!row) return c.text("Forbidden", 403);

  const groups = parseGroups(c.req.header(groupsHeader));
  const adminGroup = c.env.ADMIN_GROUP?.trim();
  const isAdmin = row.is_admin === 1 || (!!adminGroup && groups.includes(adminGroup));

  c.set("currentUser", {
    id: row.id,
    email: row.email,
    name: row.name || c.req.header(nameHeader) || row.email,
    isAdmin,
    groups,
  });

  await next();
};

export const requireAdmin: MiddlewareHandler<HonoEnv> = async (c, next) => {
  if (!c.get("currentUser").isAdmin) return c.text("Forbidden", 403);
  await next();
};
