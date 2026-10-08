"use client";

import Link from "next/link";
import { useEffect, useId, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@chainpass/api-client";
import { toast } from "sonner";
import { Ticket } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { getRole } from "@/lib/navigation";
import { invitationTokenFromHash } from "@/lib/invitation-link";
import { useCurrentTime } from "@/lib/use-current-time";
import { errorMessage, formatDate, formatPrice } from "@/lib/presentation";
import {
  PageHeading,
  LoadingCards,
  ErrorState,
  EmptyState,
  Detail,
} from "@/components/chainpass/page-kit";
import { EventCover } from "@/components/events/event-card";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

const storageKey = "chainpass.pending-invitation";
const changeEvent = "chainpass-invitation-change";
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener(changeEvent, callback);
  };
}
function snapshot() {
  // A malformed new fragment must not silently fall back to a previous invitation.
  if (window.location.hash)
    return invitationTokenFromHash(window.location.hash) ?? "invalid";
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    return stored
      ? (invitationTokenFromHash("#token=" + stored) ?? "invalid")
      : "missing";
  } catch {
    return "missing";
  }
}
function forget() {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  window.history.replaceState(null, "", "/invite");
  window.dispatchEvent(new Event(changeEvent));
}

export function InvitationEntry() {
  const token = useSyncExternalStore(subscribe, snapshot, () => "loading");
  useEffect(() => {
    if (token === "loading" || token === "missing") return;
    if (token === "invalid") {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        /* No persisted credential. */
      }
      return;
    }
    try {
      window.sessionStorage.setItem(storageKey, token);
    } catch {
      /* The original fragment remains available; auth handoff saves explicitly. */
    }
  }, [token]);
  if (token === "loading") return <LoadingCards count={1} />;
  if (token === "missing" || token === "invalid")
    return (
      <EmptyState
        title={
          token === "invalid"
            ? "Invalid invitation link"
            : "Open your invitation link"
        }
        description="Ask your organizer for a complete, valid invitation link. Invitation-only events are not shown in Discover."
        href="/events"
        action="Browse public events"
      />
    );
  return <InvitationClaim key={token} token={token} />;
}

function InvitationClaim({ token }: { token: string }) {
  const { data: session, isPending: sessionPending } = useSession();
  const router = useRouter();
  const cache = useQueryClient();
  const context = useId();
  const now = useCurrentTime();
  // An ephemeral cache identity: never place the bearer credential in query keys.
  const preview = useQuery({
    queryKey: ["invitation-preview", context, session?.user.id ?? "anonymous"],
    queryFn: () => apiClient.resolveInvitation({ token }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
  function authenticate() {
    try {
      window.sessionStorage.setItem(storageKey, token);
      window.history.replaceState(null, "", "/invite");
      router.push("/login?next=%2Finvite");
    } catch {
      toast.error(
        "This browser cannot retain the invitation. Sign in in another tab, then reopen the original link.",
      );
    }
  }
  const claim = useMutation({
    mutationFn: () =>
      apiClient.claimPass(preview.data!.ticketType.id, {
        invitationToken: token,
      }),
    gcTime: 0,
    onSuccess: (result) => {
      void cache.invalidateQueries({
        queryKey: ["my-passes", session?.user.id],
      });
      void cache.invalidateQueries({ queryKey: ["events"] });
      forget();
      router.push("/my-passes/" + result.pass.id);
      toast.success("Pass claimed. Your invitation became your ticket.");
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 401)
        authenticate();
      toast.error(errorMessage(error));
      void preview.refetch();
    },
  });
  if (preview.isPending) return <LoadingCards count={1} />;
  if (preview.isError)
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <PageHeading
          eyebrow="Invitation"
          title="Invitation unavailable"
          description="No pass has been claimed."
        />
        <ErrorState
          error={preview.error}
          retry={() => void preview.refetch()}
        />
        <Button variant="outline" onClick={forget}>
          Clear invitation
        </Button>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/my-passes" />}
        >
          Already claimed? View My Passes
        </Button>
      </div>
    );
  const { event, ticketType, expiresAt, remainingUses } = preview.data;
  const duplicate =
    claim.error instanceof ApiClientError &&
    claim.error.code === "PASS_ALREADY_CLAIMED";
  const eligibleRole =
    !session || ["user", "admin"].includes(getRole(session.user.role));
  const expired = now !== 0 && new Date(expiresAt).getTime() <= now;
  const soldOut = ticketType.remaining === 0;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeading
        eyebrow="You're invited / ChainPass"
        title={event.name}
        description={
          event.description ?? "A personal way into your next experience."
        }
      />
      <EventCover url={event.coverImageUrl} name={event.name} large />
      <Card>
        <CardHeader>
          <CardTitle>{ticketType.name}</CardTitle>
          <CardDescription>
            {ticketType.description ??
              "Claim the ticket designated by your organizer."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Badge variant="secondary">Invitation only · Forwardable link</Badge>
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail label="Organizer">{event.organizer.name}</Detail>
            <Detail label="Location">{event.location ?? "Location TBA"}</Detail>
            <Detail label="Schedule">
              {formatDate(event.startsAt)} — {formatDate(event.endsAt)}
            </Detail>
            <Detail label="Price">{formatPrice(ticketType.price)}</Detail>
            <Detail label="Ticket availability">
              {ticketType.remaining} remaining
            </Detail>
            <Detail label="Invitation availability">
              {remainingUses} claims · expires {formatDate(expiresAt)}
            </Detail>
          </dl>
          <p className="text-body-sm text-muted-foreground">
            This link is not a ticket or a check-in QR. Sign in and claim to
            create your own Pass. Previewing or forwarding does not use a claim.
            Availability is checked again when you claim.
          </p>
          {!eligibleRole && (
            <p className="text-body-sm text-muted-foreground">
              Merchant accounts manage events but cannot claim passes. Use an
              attendee account.
            </p>
          )}
          {claim.isError && (
            <ErrorState title="Pass not claimed" error={claim.error} />
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          {duplicate ? (
            <Button nativeButton={false} render={<Link href="/my-passes" />}>
              View your existing pass
            </Button>
          ) : (
            <Button
              disabled={
                sessionPending ||
                claim.isPending ||
                !eligibleRole ||
                expired ||
                soldOut
              }
              onClick={() => (session ? claim.mutate() : authenticate())}
            >
              {claim.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Ticket data-icon="inline-start" />
              )}
              {claim.isPending
                ? "Claiming…"
                : expired
                  ? "Invitation expired"
                  : soldOut
                    ? "Sold out"
                    : session
                      ? "Claim this pass"
                      : "Sign in to claim"}
            </Button>
          )}
          <Button variant="ghost" onClick={forget}>
            Clear invitation
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
