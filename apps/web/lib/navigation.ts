export type AppRole = "user" | "merchant" | "admin";

export function getRole(role?: string | null): AppRole {
  return role === "admin" || role === "merchant" ? role : "user";
}

export function roleHome(role?: string | null): string {
  return getRole(role) === "admin"
    ? "/admin"
    : getRole(role) === "merchant"
      ? "/merchant"
      : "/events";
}

/** Return only known, same-origin destinations permitted for this role. */
export function loginDestination(
  role: string | null | undefined,
  next?: string | null,
): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(next)
  )
    return roleHome(role);
  try {
    const url = new URL(next, "https://chainpass.invalid");
    const path = decodeURIComponent(url.pathname);
    if (
      url.origin !== "https://chainpass.invalid" ||
      path.startsWith("//") ||
      path.includes("\\")
    )
      return roleHome(role);
    const currentRole = getRole(role);
    // The bearer token is retained in tab-scoped storage, never in auth query strings.
    if (path === "/invite") return "/invite";
    const allowed =
      path === "/" ||
      path === "/events" ||
      path.startsWith("/events/") ||
      path === "/my-passes" ||
      path.startsWith("/my-passes/") ||
      ((currentRole === "admin" || currentRole === "merchant") &&
        (path === "/merchant" || path.startsWith("/merchant/"))) ||
      (currentRole === "admin" &&
        (path === "/admin" || path.startsWith("/admin/")));
    return allowed ? `${url.pathname}${url.search}${url.hash}` : roleHome(role);
  } catch {
    return roleHome(role);
  }
}
