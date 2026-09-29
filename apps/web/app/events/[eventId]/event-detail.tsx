"use client";

import { ApiClientError, type PublicEventDetail } from "@chainpass/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";

type ClaimState =
  | { kind: "success"; message: string }
  | {
      kind: "error";
      message: string;
      terminal?: "alreadyClaimed" | "soldOut";
    };

export function EventDetail({ eventId }: { eventId: string }) {
  const { data: session, isPending: isSessionPending } = useSession();
  const [event, setEvent] = useState<PublicEventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingTicketTypeId, setClaimingTicketTypeId] = useState<
    string | null
  >(null);
  const [claimStates, setClaimStates] = useState<Record<string, ClaimState>>(
    {},
  );

  useEffect(() => {
    let active = true;

    apiClient
      .getPublishedEvent(eventId)
      .then((result) => {
        if (active) setEvent(result);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof ApiClientError
            ? caught.message
            : "Unable to load this event.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  if (isLoading) {
    return <PageState title="Loading event…" />;
  }

  if (error || !event) {
    return (
      <PageState
        title="Event not available"
        description={error ?? "This event is not publicly available."}
      />
    );
  }

  const role = session?.user.role ?? "user";
  const canClaim = role === "user" || role === "admin";

  async function claimPass(ticketTypeId: string) {
    if (!session || !canClaim || claimingTicketTypeId) return;

    setClaimingTicketTypeId(ticketTypeId);
    setClaimStates((current) => {
      const next = { ...current };
      delete next[ticketTypeId];
      return next;
    });

    try {
      const result = await apiClient.claimPass(ticketTypeId);
      setEvent((current) =>
        current
          ? {
              ...current,
              ticketTypes: current.ticketTypes.map((ticketType) =>
                ticketType.id === ticketTypeId
                  ? { ...ticketType, remaining: result.remaining }
                  : ticketType,
              ),
            }
          : current,
      );
      setClaimStates((current) => ({
        ...current,
        [ticketTypeId]: {
          kind: "success",
          message: "Pass claimed successfully.",
        },
      }));
    } catch (caught) {
      const claimState = getClaimErrorState(caught);
      setClaimStates((current) => ({
        ...current,
        [ticketTypeId]: claimState,
      }));
    } finally {
      setClaimingTicketTypeId(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <Link
          className="text-sm font-medium text-blue-700 underline"
          href="/events"
        >
          Back to events
        </Link>

        <article className="mt-5 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div
            aria-label={event.coverImageUrl ? `${event.name} cover` : undefined}
            className="flex min-h-64 items-end bg-gradient-to-br from-blue-100 via-violet-100 to-amber-100 bg-cover bg-center p-8"
            role={event.coverImageUrl ? "img" : undefined}
            style={
              event.coverImageUrl
                ? { backgroundImage: `url(${event.coverImageUrl})` }
                : undefined
            }
          >
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold tracking-wide text-zinc-800">
              PUBLISHED
            </span>
          </div>

          <div className="p-6 sm:p-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {event.name}
            </h1>
            {event.description ? (
              <p className="mt-4 max-w-3xl whitespace-pre-wrap text-lg leading-8 text-zinc-600">
                {event.description}
              </p>
            ) : null}
            <dl className="mt-6 grid gap-4 border-t border-zinc-200 pt-6 sm:grid-cols-2">
              <Fact label="Starts" value={formatEventDate(event.startsAt)} />
              <Fact label="Ends" value={formatEventDate(event.endsAt)} />
              <Fact
                label="Location"
                value={event.location ?? "To be announced"}
              />
            </dl>
          </div>
        </article>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Available passes</h2>
          <p className="mt-2 text-zinc-600">
            Claiming creates an off-chain business Pass. Blockchain minting is
            not part of this release.
          </p>

          {event.ticketTypes.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-zinc-600">
              No passes are currently available for this event.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {event.ticketTypes.map((ticketType) => (
                <article
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                  key={ticketType.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-xl font-semibold">{ticketType.name}</h3>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                      Available
                    </span>
                  </div>
                  {ticketType.description ? (
                    <p className="mt-2 text-sm text-zinc-600">
                      {ticketType.description}
                    </p>
                  ) : null}
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <Fact label="Price" value={formatPrice(ticketType.price)} />
                    <Fact
                      label="Total"
                      value={String(ticketType.totalSupply)}
                    />
                    <Fact
                      label="Remaining"
                      value={String(ticketType.remaining)}
                    />
                  </dl>
                  <ClaimAction
                    canClaim={canClaim}
                    claimState={claimStates[ticketType.id]}
                    isClaiming={claimingTicketTypeId === ticketType.id}
                    isSessionPending={isSessionPending}
                    isSignedIn={Boolean(session)}
                    onClaim={() => claimPass(ticketType.id)}
                    remaining={ticketType.remaining}
                  />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ClaimAction({
  canClaim,
  claimState,
  isClaiming,
  isSessionPending,
  isSignedIn,
  onClaim,
  remaining,
}: {
  canClaim: boolean;
  claimState?: ClaimState;
  isClaiming: boolean;
  isSessionPending: boolean;
  isSignedIn: boolean;
  onClaim: () => void;
  remaining: number;
}) {
  if (isSessionPending) {
    return (
      <button
        className="mt-5 w-full rounded-lg bg-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600"
        disabled
      >
        Checking session…
      </button>
    );
  }

  if (!isSignedIn) {
    return (
      <Link
        className="mt-5 inline-flex w-full justify-center rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white"
        href="/auth-test"
      >
        Sign in to claim
      </Link>
    );
  }

  if (!canClaim) {
    return (
      <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        This account role cannot claim passes.
      </p>
    );
  }

  const wasClaimed = claimState?.kind === "success";
  const wasAlreadyClaimed =
    claimState?.kind === "error" && claimState.terminal === "alreadyClaimed";
  const isSoldOut =
    remaining === 0 ||
    (claimState?.kind === "error" && claimState.terminal === "soldOut");

  return (
    <div className="mt-5">
      <button
        className="w-full rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isClaiming || isSoldOut || wasClaimed || wasAlreadyClaimed}
        onClick={onClaim}
        type="button"
      >
        {isClaiming
          ? "Claiming…"
          : wasClaimed
            ? "Claimed"
            : wasAlreadyClaimed
              ? "Already claimed"
              : isSoldOut
                ? "Sold out"
                : "Claim pass"}
      </button>
      {claimState ? (
        <p
          className={`mt-3 rounded-lg px-4 py-3 text-sm ${
            claimState.kind === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
          role={claimState.kind === "error" ? "alert" : undefined}
        >
          {claimState.message}
          {claimState.kind === "success" ? (
            <Link className="ml-2 font-medium underline" href="/my-passes">
              View My Passes
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-950">{value}</dd>
    </div>
  );
}

function PageState({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-6 text-zinc-950">
      <section className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-3 text-zinc-600">{description}</p>
        ) : null}
        <Link
          className="mt-5 inline-flex font-medium text-blue-700 underline"
          href="/events"
        >
          Browse events
        </Link>
      </section>
    </main>
  );
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPrice(price: string) {
  return price === "0" ? "Free" : `${price} minor units`;
}

function getClaimErrorState(error: unknown): ClaimState {
  if (!(error instanceof ApiClientError)) {
    return {
      kind: "error",
      message: "Unable to claim this pass. Please try again.",
    };
  }

  if (error.code === "PASS_ALREADY_CLAIMED") {
    return {
      kind: "error",
      message: "You already claimed this pass.",
      terminal: "alreadyClaimed",
    };
  }

  if (error.code === "TICKET_TYPE_SOLD_OUT") {
    return {
      kind: "error",
      message: "This pass is sold out.",
      terminal: "soldOut",
    };
  }

  return { kind: "error", message: error.message };
}
