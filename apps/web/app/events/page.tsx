"use client";

import { ApiClientError, type PublicEventSummary } from "@chainpass/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

export default function PublishedEventsPage() {
  const [events, setEvents] = useState<PublicEventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    apiClient
      .listPublishedEvents()
      .then((result) => {
        if (active) setEvents(result);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof ApiClientError
            ? caught.message
            : "Unable to load published events.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="text-sm font-medium text-blue-700">ChainPass events</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Discover events
          </h1>
          <p className="mt-3 text-lg text-zinc-600">
            Browse published events and see the passes currently available.
          </p>
        </header>

        {isLoading ? (
          <StatusCard title="Loading published events…" />
        ) : error ? (
          <StatusCard title="Unable to load events" description={error} />
        ) : events.length === 0 ? (
          <StatusCard
            title="No published events yet"
            description="Published events will appear here as soon as organizers make them available."
          />
        ) : (
          <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <article
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                key={event.id}
              >
                <Cover imageUrl={event.coverImageUrl} name={event.name} />
                <div className="p-5">
                  <h2 className="text-xl font-semibold">{event.name}</h2>
                  <dl className="mt-4 space-y-2 text-sm text-zinc-600">
                    <Metadata
                      label="Date"
                      value={formatEventDate(event.startsAt)}
                    />
                    <Metadata
                      label="Location"
                      value={event.location ?? "To be announced"}
                    />
                  </dl>
                  <Link
                    className="mt-5 inline-flex rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                    href={`/events/${event.id}`}
                  >
                    View event
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function Cover({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <div
      aria-label={imageUrl ? `${name} cover` : undefined}
      className="flex aspect-[16/9] items-end bg-gradient-to-br from-blue-100 via-violet-100 to-amber-100 bg-cover bg-center p-5"
      role={imageUrl ? "img" : undefined}
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      {!imageUrl ? (
        <span className="text-sm font-medium text-zinc-700">
          ChainPass event
        </span>
      ) : null}
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="font-medium text-zinc-900">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatusCard({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  return (
    <section className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-xl text-zinc-600">{description}</p>
      ) : null}
    </section>
  );
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
