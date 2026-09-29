"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ApiClientError,
  type CreateEventInput,
  type EventResponse,
} from "@chainpass/api-client";
import { createEventInputSchema } from "@chainpass/schemas";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const localDateTimeToIso = (value: unknown) =>
  typeof value === "string" && value !== ""
    ? new Date(value).toISOString()
    : value;

export default function CreateEventPage() {
  const { data: session, isPending: isSessionPending } = useSession();
  const [createdEvent, setCreatedEvent] = useState<EventResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventInput>({
    resolver: zodResolver(createEventInputSchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      coverImageUrl: undefined,
      startsAt: "",
      endsAt: "",
    },
  });

  if (isSessionPending) {
    return <PageMessage title="Checking your session…" />;
  }

  if (!session) {
    return (
      <PageMessage
        title="Sign in required"
        description="Sign in with a merchant or admin account before creating an event."
      >
        <Link className="font-medium text-blue-700 underline" href="/auth-test">
          Open sign in
        </Link>
      </PageMessage>
    );
  }

  const role = session.user.role ?? "user";

  if (role !== "merchant" && role !== "admin") {
    return (
      <PageMessage
        title="Merchant access required"
        description="Your account does not have permission to create events."
      />
    );
  }

  async function onSubmit(input: CreateEventInput) {
    setSubmitError(null);
    setCreatedEvent(null);

    try {
      setCreatedEvent(await apiClient.createEvent(input));
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message);
        return;
      }

      setSubmitError("Unable to create the event. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium text-blue-700">
            Merchant workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Create event
          </h1>
          <p className="mt-2 text-zinc-600">
            Start with the event details. New events are saved as drafts.
          </p>
        </header>

        <form
          className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          onSubmit={handleSubmit(onSubmit)}
        >
          <FormField label="Event name" error={errors.name?.message} required>
            <input
              className="input"
              placeholder="ChainPass Hackathon 2026"
              {...register("name")}
            />
          </FormField>

          <FormField label="Description" error={errors.description?.message}>
            <textarea
              className="input min-h-28 resize-y"
              placeholder="What should attendees know?"
              {...register("description", { setValueAs: optionalText })}
            />
          </FormField>

          <FormField label="Location" error={errors.location?.message}>
            <input
              className="input"
              placeholder="Beijing"
              {...register("location", { setValueAs: optionalText })}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Start time"
              error={errors.startsAt?.message}
              required
            >
              <input
                className="input"
                type="datetime-local"
                {...register("startsAt", { setValueAs: localDateTimeToIso })}
              />
            </FormField>

            <FormField label="End time" error={errors.endsAt?.message} required>
              <input
                className="input"
                type="datetime-local"
                {...register("endsAt", { setValueAs: localDateTimeToIso })}
              />
            </FormField>
          </div>

          <FormField
            label="Cover image URL"
            error={errors.coverImageUrl?.message}
          >
            <input
              className="input"
              type="url"
              placeholder="https://example.com/event-cover.png"
              {...register("coverImageUrl", { setValueAs: optionalText })}
            />
          </FormField>

          {submitError ? (
            <p
              className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <button
            className="w-full rounded-lg bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating event…" : "Create event"}
          </button>
        </form>

        {createdEvent ? (
          <section
            className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
            aria-live="polite"
          >
            <h2 className="text-lg font-semibold text-emerald-950">
              Event created successfully
            </h2>
            <dl className="mt-4 grid gap-3 text-sm text-emerald-950 sm:grid-cols-2">
              <Result label="Event ID" value={createdEvent.id} />
              <Result label="Name" value={createdEvent.name} />
              <Result label="Status" value={createdEvent.status} />
              <Result label="Organizer" value={createdEvent.organizerId} />
            </dl>
            <Link
              className="mt-5 inline-flex rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white"
              href={`/merchant/events/${createdEvent.id}`}
            >
              Manage event and issue tickets
            </Link>
          </section>
        ) : null}
      </div>
    </main>
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

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-emerald-800">{label}</dt>
      <dd className="mt-1 break-all">{value}</dd>
    </div>
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
