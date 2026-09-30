"use client";

import { ApiClientError, type VerifyPassResponse } from "@chainpass/api-client";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";

export default function MerchantCheckInPage() {
  const { data: session, isPending: isSessionPending } = useSession();
  const [passId, setPassId] = useState("");
  const [result, setResult] = useState<VerifyPassResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  if (isSessionPending) return <PageMessage title="Checking your session…" />;

  if (!session) {
    return (
      <PageMessage
        title="Sign in required"
        description="Sign in with a merchant or admin account to verify passes."
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
        description="Your account cannot verify or check in event passes."
      />
    );
  }

  async function verifyPass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPassId = passId.trim();
    if (!normalizedPassId || isVerifying) return;

    setIsVerifying(true);
    setError(null);
    setResult(null);
    setCheckedIn(false);

    try {
      setResult(await apiClient.verifyPass(normalizedPassId));
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to verify this pass."));
    } finally {
      setIsVerifying(false);
    }
  }

  async function checkInPass() {
    if (!result?.canCheckIn || isCheckingIn) return;

    setIsCheckingIn(true);
    setError(null);

    try {
      setResult(await apiClient.checkInPass(result.pass.id));
      setCheckedIn(true);
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to check in this pass."));
    } finally {
      setIsCheckingIn(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-3xl">
        <Link
          className="text-sm font-medium text-blue-700 underline"
          href="/merchant/events/new"
        >
          Merchant workspace
        </Link>
        <header className="mt-5">
          <p className="text-sm font-medium text-blue-700">Gate operations</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Verify and check in a pass
          </h1>
          <p className="mt-2 text-zinc-600">
            Enter the database Pass ID. Verification is read-only until you
            confirm check-in.
          </p>
        </header>

        <form
          className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          onSubmit={verifyPass}
        >
          <label className="block text-sm font-medium" htmlFor="pass-id">
            Pass ID
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              className="input flex-1"
              id="pass-id"
              onChange={(event) => setPassId(event.target.value)}
              placeholder="clx…"
              required
              value={passId}
            />
            <button
              className="rounded-lg bg-zinc-950 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isVerifying || passId.trim() === ""}
              type="submit"
            >
              {isVerifying ? "Verifying…" : "Verify pass"}
            </button>
          </div>
        </form>

        {error ? (
          <p
            className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {result ? (
          <VerificationCard
            checkedIn={checkedIn}
            isCheckingIn={isCheckingIn}
            onCheckIn={checkInPass}
            result={result}
          />
        ) : null}
      </div>
    </main>
  );
}

function VerificationCard({
  checkedIn,
  isCheckingIn,
  onCheckIn,
  result,
}: {
  checkedIn: boolean;
  isCheckingIn: boolean;
  onCheckIn: () => void;
  result: VerifyPassResponse;
}) {
  const title = checkedIn
    ? "CHECKED IN ✓"
    : result.verificationStatus.replaceAll("_", " ");
  const isValid = result.verificationStatus === "VALID";

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-sm font-semibold ${isValid ? "text-emerald-700" : "text-amber-700"}`}
          >
            {title}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{result.event.name}</h2>
          <p className="mt-1 text-zinc-600">{result.ticketType.name}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium">
          {result.pass.status}
        </span>
      </div>

      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Pass ID" value={result.pass.id} />
        <Detail label="Holder" value={result.holder.name} />
        <Detail label="Email" value={result.holder.email} />
        <Detail label="Blockchain" value={result.onChainStatus} />
        <Detail
          label="Event time"
          value={new Date(result.event.startsAt).toLocaleString()}
        />
        <Detail label="Location" value={result.event.location ?? "TBA"} />
      </dl>

      {result.checkIn ? (
        <div className="mt-6 rounded-xl bg-zinc-50 p-4 text-sm">
          <p className="font-medium">Already checked in</p>
          <p className="mt-1 text-zinc-600">
            {new Date(result.checkIn.verifiedAt).toLocaleString()} by{" "}
            {result.checkIn.verifiedBy.name}
          </p>
        </div>
      ) : null}

      {result.canCheckIn ? (
        <button
          className="mt-6 rounded-lg bg-emerald-700 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCheckingIn}
          onClick={onCheckIn}
          type="button"
        >
          {isCheckingIn ? "Checking in…" : "Confirm check-in"}
        </button>
      ) : null}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
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
      <section className="max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-3 text-zinc-600">{description}</p>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </section>
    </main>
  );
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.status === 404) return "Pass not found.";
    if (error.status === 403) return "You cannot verify this event's pass.";
    if (error.code === "PASS_ALREADY_CHECKED_IN") {
      return "This pass has already been checked in.";
    }
    return error.message;
  }

  return fallback;
}
