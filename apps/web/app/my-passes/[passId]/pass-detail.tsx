"use client";

import {
  ApiClientError,
  type PassVerificationTokenResponse,
  type PassView,
} from "@chainpass/api-client";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";

const TOKEN_REFRESH_LEAD_MS = 10_000;
const PASS_STATUS_POLL_MS = 5_000;

export function PassDetail({ passId }: { passId: string }) {
  const { data: session, isPending: isSessionPending } = useSession();
  const [pass, setPass] = useState<PassView | null>(null);
  const [token, setToken] = useState<PassVerificationTokenResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tokenRequestInFlight = useRef(false);

  const fetchPass = useCallback(async () => {
    const passes = await apiClient.getMyPasses();
    return passes.find((candidate) => candidate.id === passId) ?? null;
  }, [passId]);

  const refreshToken = useCallback(async () => {
    if (tokenRequestInFlight.current) return;
    tokenRequestInFlight.current = true;
    setIsRefreshing(true);
    setError(null);

    try {
      setToken(await apiClient.createPassVerificationToken(passId));
    } catch (caught) {
      if (
        caught instanceof ApiClientError &&
        caught.code === "PASS_NOT_ACTIVE"
      ) {
        const current = await fetchPass();
        setPass(current);
        if (current?.status !== "ACTIVE") setToken(null);
      } else {
        setError(
          caught instanceof ApiClientError
            ? caught.message
            : "Unable to refresh the QR code.",
        );
      }
    } finally {
      setIsRefreshing(false);
      tokenRequestInFlight.current = false;
    }
  }, [fetchPass, passId]);

  useEffect(() => {
    if (isSessionPending || !session) return;

    let active = true;
    fetchPass()
      .then((current) => {
        if (!active) return;
        setPass(current);
        if (current?.status === "ACTIVE") return refreshToken();
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof ApiClientError
            ? caught.message
            : "Unable to load this pass.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchPass, isSessionPending, refreshToken, session]);

  useEffect(() => {
    if (!session || pass?.status !== "ACTIVE") return;

    const poll = window.setInterval(() => {
      void fetchPass()
        .then((current) => {
          setPass(current);
          if (current?.status !== "ACTIVE") setToken(null);
        })
        .catch(() => undefined);
    }, PASS_STATUS_POLL_MS);
    return () => window.clearInterval(poll);
  }, [fetchPass, pass?.status, session]);

  useEffect(() => {
    if (!token || pass?.status !== "ACTIVE") return;

    const expiresAt = new Date(token.expiresAt).getTime();
    const updateCountdown = () => {
      setSecondsRemaining(
        Math.max(0, Math.ceil((expiresAt - Date.now()) / 1_000)),
      );
    };
    updateCountdown();
    const countdown = window.setInterval(updateCountdown, 1_000);
    const refresh = window.setTimeout(
      () => void refreshToken(),
      Math.max(0, expiresAt - Date.now() - TOKEN_REFRESH_LEAD_MS),
    );
    const expire = window.setTimeout(
      () =>
        setToken((current) =>
          current?.token === token.token ? null : current,
        ),
      Math.max(0, expiresAt - Date.now()),
    );

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(refresh);
      window.clearTimeout(expire);
    };
  }, [pass?.status, refreshToken, token]);

  if (isSessionPending || isLoading) {
    return <PageState title="Loading your pass…" />;
  }
  if (!session) {
    return (
      <PageState title="Sign in required">
        <Link className="font-medium text-blue-700 underline" href="/auth-test">
          Open sign in
        </Link>
      </PageState>
    );
  }
  if (!pass) {
    return (
      <PageState
        title="Pass not found"
        description="This pass is not owned by your account."
      />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-3xl">
        <Link
          className="text-sm font-medium text-blue-700 underline"
          href="/my-passes"
        >
          Back to My Passes
        </Link>
        <section className="mt-5 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <header className="border-b border-zinc-200 p-7">
            <p className="text-sm font-medium text-blue-700">
              {pass.ticketType.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {pass.event.name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-zinc-600">
              <span>{new Date(pass.event.startsAt).toLocaleString()}</span>
              <span>·</span>
              <span>{pass.event.location ?? "Location TBA"}</span>
            </div>
          </header>

          <div className="grid gap-8 p-7 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm text-zinc-500">Holder</p>
              <p className="mt-1 text-lg font-medium">
                {session.user.name ?? session.user.email}
              </p>
              <dl className="mt-6 space-y-4 text-sm">
                <Detail label="Pass status" value={pass.status} />
                <Detail
                  label="On-chain status"
                  value={pass.onChainStatus.replaceAll("_", " ")}
                />
                <Detail label="Pass ID" value={pass.id} />
              </dl>
            </div>

            <div className="flex min-h-72 min-w-72 items-center justify-center rounded-2xl bg-zinc-50 p-5 text-center">
              {pass.status === "CHECKED_IN" ? (
                <StatusPanel
                  title="CHECKED IN"
                  description="This pass has already been used."
                />
              ) : pass.status === "REVOKED" ? (
                <StatusPanel
                  title="REVOKED"
                  description="This pass is no longer valid."
                />
              ) : token ? (
                <div aria-live="polite">
                  <QRCodeSVG
                    aria-label="Dynamic pass verification QR code"
                    bgColor="#ffffff"
                    fgColor="#18181b"
                    level="M"
                    marginSize={4}
                    size={240}
                    value={token.token}
                  />
                  <p className="mt-4 text-sm font-medium">
                    Refreshes in {secondsRemaining}s
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {isRefreshing
                      ? "Refreshing secure code…"
                      : "Short-lived verification code"}
                  </p>
                </div>
              ) : (
                <StatusPanel
                  title={isRefreshing ? "Loading QR…" : "QR unavailable"}
                  description={error ?? "Request a new verification code."}
                >
                  {!isRefreshing ? (
                    <button
                      className="mt-4 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white"
                      onClick={() => void refreshToken()}
                      type="button"
                    >
                      Retry
                    </button>
                  ) : null}
                </StatusPanel>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
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

function StatusPanel({
  children,
  description,
  title,
}: {
  children?: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xl font-semibold">{title}</p>
      <p className="mt-2 max-w-56 text-sm text-zinc-600">{description}</p>
      {children}
    </div>
  );
}

function PageState({
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
