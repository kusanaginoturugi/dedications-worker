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

export const requireUser: MiddlewareHandler<HonoEnv> = async (c, next) => {
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
