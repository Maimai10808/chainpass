"use client";

import { ApiClientError, type PublicEventDetail } from "@chainpass/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

export function EventDetail({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<PublicEventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            Pass claiming is not enabled in this release.
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
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
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
