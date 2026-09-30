"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ApiClientError,
  type CreateTicketTypeInput,
  type EventResponse,
  type TicketTypeResponse,
} from "@chainpass/api-client";
import { createTicketTypeInputSchema } from "@chainpass/schemas";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export function EventManagement({ eventId }: { eventId: string }) {
  const { data: session, isPending: isSessionPending } = useSession();
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTicketTypeInput>({
    resolver: zodResolver(createTicketTypeInputSchema),
    defaultValues: {
      name: "",
      description: "",
      totalSupply: 100,
      price: 0,
    },
  });

  const role = session?.user.role ?? "user";
  const canUseMerchantFlow = role === "merchant" || role === "admin";

  useEffect(() => {
    if (isSessionPending || !session || !canUseMerchantFlow) {
      return;
    }

    let active = true;

    Promise.all([
      apiClient.getManagedEvent(eventId),
      apiClient.listTicketTypes(eventId),
    ])
      .then(([eventResult, ticketTypeResult]) => {
        if (!active) return;
        setEvent(eventResult);
        setTicketTypes(ticketTypeResult);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(getErrorMessage(error, "Unable to load this event."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canUseMerchantFlow, eventId, isSessionPending, session]);

  if (isSessionPending) {
    return <PageMessage title="Loading event…" />;
  }

  if (!session) {
    return (
      <PageMessage
        title="Sign in required"
        description="Sign in with a merchant or admin account to manage ticket types."
      >
        <Link className="font-medium text-blue-700 underline" href="/auth-test">
          Open sign in
        </Link>
      </PageMessage>
    );
  }

  if (!canUseMerchantFlow) {
    return (
      <PageMessage
        title="Merchant access required"
        description="Your account does not have permission to issue tickets."
      />
    );
  }

  if (isLoading) {
    return <PageMessage title="Loading event…" />;
  }

  if (loadError || !event) {
    return (
      <PageMessage
        title="Unable to load event"
        description={loadError ?? "Event not found."}
      />
    );
  }

  const ownsEvent = role === "admin" || event.organizerId === session.user.id;

  if (!ownsEvent) {
    return (
      <PageMessage
        title="Event ownership required"
        description="Only this event's organizer or an admin can issue ticket types."
      />
    );
  }

  async function onSubmit(input: CreateTicketTypeInput) {
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const created = await apiClient.createTicketType(eventId, input);
      setTicketTypes((current) => [...current, created]);
      setPublishError(null);
      setSuccessMessage(`${created.name} created successfully.`);
      reset({ name: "", description: "", totalSupply: 100, price: 0 });
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, "Unable to create the ticket type."),
      );
    }
  }

  async function publishEvent() {
    if (isPublishing || event?.status !== "DRAFT") return;

    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);

    try {
      const published = await apiClient.publishEvent(eventId);
      setEvent(published);
      setPublishSuccess("Event published successfully.");
    } catch (error) {
      setPublishError(getErrorMessage(error, "Unable to publish this event."));
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-4xl">
        <nav className="flex flex-wrap gap-4 text-sm font-medium text-blue-700 underline">
          <Link href="/merchant/events/new">Create another event</Link>
          <Link href="/merchant/check-in">Check in a pass</Link>
        </nav>

        <header className="mt-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-blue-700">
            Merchant event management
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {event.name}
            </h1>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium">
              {event.status}
            </span>
          </div>
          <p className="mt-3 break-all text-sm text-zinc-500">
            Event ID: {event.id}
          </p>

          {event.status === "DRAFT" ? (
            <div className="mt-6 border-t border-zinc-200 pt-5">
              <p className="text-sm text-zinc-600">
                Publishing makes this event and its active ticket types visible
                to everyone. At least one active ticket type is required.
              </p>
              {publishError ? (
                <p
                  className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {publishError}
                </p>
              ) : null}
              <button
                className="mt-4 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPublishing}
                onClick={publishEvent}
                type="button"
              >
                {isPublishing ? "Publishing…" : "Publish event"}
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-zinc-200 pt-5">
              <Link
                className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white"
                href={`/events/${event.id}`}
              >
                View public event
              </Link>
              {publishSuccess ? (
                <p
                  className="text-sm font-medium text-emerald-700"
                  aria-live="polite"
                >
                  {publishSuccess}
                </p>
              ) : null}
            </div>
          )}
        </header>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold">Ticket types</h2>
            <p className="mt-1 text-zinc-600">
              Ticket inventory is stored in PostgreSQL and is not issued
              on-chain at this stage.
            </p>
          </div>

          {ticketTypes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-zinc-600">
              No ticket types yet. Create the first one below.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {ticketTypes.map((ticketType) => (
                <article
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                  key={ticketType.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{ticketType.name}</h3>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                      {ticketType.status}
                    </span>
                  </div>
                  {ticketType.description ? (
                    <p className="mt-2 text-sm text-zinc-600">
                      {ticketType.description}
                    </p>
                  ) : null}
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Metric label="Supply" value={ticketType.totalSupply} />
                    <Metric label="Claimed" value={ticketType.claimedCount} />
                    <Metric
                      label="Price"
                      value={formatPrice(ticketType.price)}
                    />
                    <Metric
                      label="Remaining"
                      value={ticketType.totalSupply - ticketType.claimedCount}
                    />
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Create ticket type</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Price is an integer in the smallest currency unit. Use 0 for a free
            ticket.
          </p>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <FormField label="Name" error={errors.name?.message} required>
              <input
                className="input"
                placeholder="General Pass"
                {...register("name")}
              />
            </FormField>

            <FormField label="Description" error={errors.description?.message}>
              <textarea
                className="input min-h-24 resize-y"
                placeholder="General admission"
                {...register("description", { setValueAs: optionalText })}
              />
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                label="Total supply"
                error={errors.totalSupply?.message}
                required
              >
                <input
                  className="input"
                  min="1"
                  step="1"
                  type="number"
                  {...register("totalSupply", { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                label="Price (minor units)"
                error={errors.price?.message}
                required
              >
                <input
                  className="input"
                  min="0"
                  step="1"
                  type="number"
                  {...register("price", { valueAsNumber: true })}
                />
              </FormField>
            </div>

            {submitError ? (
              <p
                className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}

            {successMessage ? (
              <p
                className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                aria-live="polite"
              >
                {successMessage}
              </p>
            ) : null}

            <button
              className="w-full rounded-lg bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating ticket type…" : "Create ticket type"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function formatPrice(price: string) {
  return price === "0" ? "Free" : `${price} minor units`;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function FormField({
  children,
  error,
  label,
  required = false,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      {error ? (
        <span className="block text-sm text-red-600">{error}</span>
      ) : null}
    </label>
  );
}

function PageMessage({
  children,
  description,
  title,
}: {
  children?: React.ReactNode;
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
        {children ? <div className="mt-5">{children}</div> : null}
      </section>
    </main>
  );
}
