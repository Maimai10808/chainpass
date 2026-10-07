"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { getRole, roleHome, type AppRole } from "@/lib/navigation";
import {
  EmptyState,
  ErrorState,
  LoadingCards,
} from "@/components/chainpass/page-kit";

export function RouteGate({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: AppRole[];
}) {
  const { data: session, isPending, error, refetch } = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!isPending && !session && !error) {
      router.replace(
        `/login?next=${encodeURIComponent(path + window.location.search)}`,
      );
    }
  }, [error, isPending, path, router, session]);
  if (isPending || (!session && !error))
    return (
      <div className="py-12">
        <LoadingCards count={2} />
      </div>
    );
  if (error)
    return (
      <ErrorState
        title="Unable to check your session"
        error={error}
        retry={() => void refetch()}
      />
    );
  if (!session) return null;
  if (roles && !roles.includes(getRole(session.user.role))) {
    return (
      <EmptyState
        title="Access restricted"
        description="This workspace requires a different account role."
        href={roleHome(session.user.role)}
        action="Go to my workspace"
      />
    );
  }
  return children;
}
