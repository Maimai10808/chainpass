/** Credentials stay in the URL fragment, never the server-visible path/query. */
export function invitationTokenFromHash(hash: string): string | null {
  const values = new URLSearchParams(hash.replace(/^#/, ""));
  const token = values.get("token");
  return values.getAll("token").length === 1 &&
    token &&
    /^[A-Za-z0-9_-]{43}$/.test(token)
    ? token
    : null;
}

export function invitationLink(origin: string, token: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("Invalid invitation credential");
  const url = new URL("/invite", origin);
  url.hash = "token=" + token;
  return url.toString();
}
