const AUTH_WORKER =
  "https://sylu-icdl-auth.hugozhao6.workers.dev";

const SESSION_KEY = "sylu_icdl_session";

export type PlatformRole = "pending" | "member" | "editor" | "admin";

export interface AuthUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export interface AuthOrganization {
  login: string;
  role: string;
  state: string;
}

export interface PlatformAccess {
  authorized: boolean;
  role: PlatformRole;
  status: string;
  studentId: string | null;
  name: string | null;
  canWriteDocuments: boolean;
  isAdmin: boolean;
}

export interface AuthMe {
  authenticated: true;
  user: AuthUser;
  organization: AuthOrganization;
  access: PlatformAccess;
  expiresAt: number;
}

export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function consumeSessionFromHash(): boolean {
  if (!window.location.hash) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const session = params.get("session");
  if (!session) return false;
  sessionStorage.setItem(SESSION_KEY, session);
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

export function buildGitHubLoginUrl(returnTo: string): string {
  const url = new URL(`${AUTH_WORKER}/auth/github/start`);
  url.searchParams.set("return_to", returnTo);
  return url.toString();
}

export async function getCurrentUser(): Promise<AuthMe | null> {
  const session = getSessionToken();
  if (!session) return null;
  try {
    const response = await fetch(`${AUTH_WORKER}/api/me`, {
      headers: { Authorization: `Bearer ${session}` },
      cache: "no-store",
    });
    if (response.status === 401) {
      clearSession();
      return null;
    }
    if (!response.ok) return null;
    return (await response.json()) as AuthMe;
  } catch (error) {
    console.error("Unable to reach authentication service:", error);
    return null;
  }
}

export function getSafeNextUrl(rawNext: string | null, fallbackPath: string): string {
  try {
    const candidate = new URL(rawNext || fallbackPath, window.location.origin);
    if (candidate.origin !== window.location.origin) return fallbackPath;
    return candidate.pathname + candidate.search;
  } catch {
    return fallbackPath;
  }
}

export function hasRole(me: AuthMe | null, required: "member" | "editor" | "admin"): boolean {
  if (!me?.access.authorized) return false;
  const rank: Record<PlatformRole, number> = { pending: 0, member: 1, editor: 2, admin: 3 };
  return rank[me.access.role] >= rank[required];
}
