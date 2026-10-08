import { Redirect, type Href, usePathname } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { getRole, roleHome, type Role } from "@/lib/product";
import { ScreenState } from "./ui";
import { pendingInvitation } from "@/lib/pending-invitation";
export function SessionBoundary({ children }: PropsWithChildren) {
  const { data: session, isPending } = useSession();
  const [restored, setRestored] = useState(false);
  // Preserve the navigator after boot. Unmounting it during auth revalidation
  // resets a modal sign-in return to the root route; RoleGate still protects
  // private screens while their session is pending.
  if (!isPending && !restored) setRestored(true);
  const client = useQueryClient();
  const identity = session
    ? `${session.user.id}:${session.user.role}`
    : "anonymous";
  const previous = useRef(identity);
  useEffect(() => {
    if (previous.current !== identity) {
      // Keep anonymous -> login handoff; clear on logout/account or role changes.
      if (previous.current !== "anonymous") void pendingInvitation.clear();
      void client.cancelQueries({ queryKey: ["private"] });
      client.removeQueries({ queryKey: ["private"] });
      client.getMutationCache().clear();
      previous.current = identity;
    }
  }, [client, identity]);
  if (!restored)
    return (
      <ScreenState
        loading
        title="ChainPass"
        description="Restoring your secure session…"
      />
    );
  return children;
}
export function RoleGate({
  roles,
  children,
}: PropsWithChildren<{ roles: readonly Role[] }>) {
  const { data: session, isPending } = useSession();
  const path = usePathname();
  if (isPending) return <ScreenState loading title="Restoring your session…" />;
  if (!session)
    return (
      <Redirect
        href={{ pathname: "/auth/sign-in", params: { returnTo: path } }}
      />
    );
  if (!roles.includes(getRole(session.user)))
    return <Redirect href={roleHome(getRole(session.user)) as Href} />;
  return children;
}
