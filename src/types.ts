export type Bindings = {
  DB: D1Database;
  REPORT_RENDERER: Fetcher;
  AUTH_EMAIL_HEADER?: string;
  AUTH_NAME_HEADER?: string;
  AUTH_GROUPS_HEADER?: string;
  ADMIN_GROUP?: string;
  MASTERS_URL?: string;
};

export type AppVariables = {
  currentUser: CurrentUser;
};

export type CurrentUser = {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;
  groups: string[];
};

export type HonoEnv = {
  Bindings: Bindings;
  Variables: AppVariables;
};
