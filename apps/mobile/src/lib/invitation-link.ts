import { invitationTokenSchema } from "@chainpass/schemas";

export function invitationTokenFromHash(hash: string): string | null {
  const values = new URLSearchParams(hash.replace(/^#/, ""));
  const token = values.get("token");
  return values.getAll("token").length === 1 &&
    invitationTokenSchema.safeParse(token).success
    ? token
    : null;
}

/** Only extract a credential. Never request a pasted URL or follow its redirects. */
export function invitationTokenFromLink(
  link: string,
  appOrigin?: string,
): string | null {
  try {
    const url = new URL(link.trim());
    if (url.username || url.password || url.search) return null;
    if (url.protocol === "chainpass:") {
      if (url.hostname !== "invite" || (url.pathname && url.pathname !== "/"))
        return null;
    } else {
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.pathname !== "/invite"
      )
        return null;
      if (appOrigin && url.origin !== new URL(appOrigin).origin) return null;
    }
    return invitationTokenFromHash(url.hash);
  } catch {
    return null;
  }
}

export function invitationLink(origin: string, token: string): string {
  invitationTokenSchema.parse(token);
  const url = new URL("/invite", origin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Configure a public HTTP(S) application origin");
  url.hash = `token=${token}`;
  return url.toString();
}

export function nativeInvitationLink(token: string): string {
  invitationTokenSchema.parse(token);
  return `chainpass://invite#token=${token}`;
}
