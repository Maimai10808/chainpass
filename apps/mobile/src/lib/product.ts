/** Presentation only; permissions and validity are always checked by the API. */
/** Better Auth treats a URL with a path as its complete auth endpoint. */
export function authEndpoint(apiUrl: string): string {
  return `${apiUrl.replace(/\/+$/, "").replace(/\/api$/, "")}/api/auth`;
}
export type Role = "user" | "merchant" | "admin";
export function getRole(user?: { role?: string | null } | null): Role {
  return user?.role === "admin"
    ? "admin"
    : user?.role === "merchant"
      ? "merchant"
      : "user";
}
export function roleHome(role: Role): "/" | "/merchant" | "/admin" {
  return role === "user" ? "/" : role === "merchant" ? "/merchant" : "/admin";
}
export function authDestination(role: Role, path?: string): string {
  if (!path || /[\\?#%]/.test(path) || path.includes(".."))
    return roleHome(role);
  const publicRoute = /^\/events\/[^/]+$/.test(path);
  const userRoute =
    /^\/my-passes(?:\/[^/]+)?$/.test(path) ||
    path === "/profile" ||
    path === "/invite";
  const merchantRoute =
    /^\/merchant(?:\/events(?:\/[^/]+)?|\/check-in|\/profile)?$/.test(path);
  const adminRoute = /^\/admin(?:\/users|\/events|\/profile)?$/.test(path);
  return publicRoute ||
    (userRoute && role !== "merchant") ||
    (merchantRoute && role !== "user") ||
    (adminRoute && role === "admin")
    ? path
    : roleHome(role);
}
export const keys = {
  events: ["events"] as const,
  event: (id: string) => ["event", id] as const,
  passes: (uid: string) => ["private", uid, "passes"] as const,
  wallet: (uid: string) => ["private", uid, "wallet"] as const,
  qr: (uid: string, id: string) => ["private", uid, "qr", id] as const,
  merchantEvents: (uid: string) => ["private", uid, "merchant-events"] as const,
  managedEvent: (uid: string, id: string) =>
    ["private", uid, "managed-event", id] as const,
  tickets: (uid: string, id: string) =>
    ["private", uid, "tickets", id] as const,
  invitations: (uid: string, id: string) =>
    ["private", uid, "invitations", id] as const,
  adminEvents: (uid: string) => ["private", uid, "admin-events"] as const,
  users: (uid: string) => ["private", uid, "users"] as const,
};
export function qrState(
  status: string,
  active: boolean,
  expiry?: string,
  now = Date.now(),
) {
  if (status !== "ACTIVE") return "disabled";
  if (!active) return "paused";
  if (!expiry) return "loading";
  return Date.parse(expiry) > now ? "ready" : "expired";
}
export function qrRefreshDelay(expiry: string, now = Date.now()) {
  return Math.max(0, Date.parse(expiry) - now - 10_000);
}
export function cameraShouldRun(
  focused: boolean,
  active: boolean,
  granted: boolean,
  scanning: boolean,
) {
  return focused && active && granted && scanning;
}
export function canConfirmCheckIn(
  result: { canCheckIn: boolean; verificationStatus: string } | null,
) {
  return result?.canCheckIn === true && result.verificationStatus === "VALID";
}
export function walletCanBind(
  address: string | undefined,
  chainId: string | number | undefined,
) {
  return Boolean(
    address &&
    /^0x[0-9a-fA-F]{40}$/.test(address) &&
    Number(chainId) === 11155111,
  );
}
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
