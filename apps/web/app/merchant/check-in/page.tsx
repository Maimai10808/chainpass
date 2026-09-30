"use client";

import type { IScannerControls } from "@zxing/browser";
import { ApiClientError, type VerifyPassResponse } from "@chainpass/api-client";
import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";

type VerificationMethod = "MANUAL" | "QR";
type ScannerState =
  | "idle"
  | "starting"
  | "scanning"
  | "verifying"
  | "expired"
  | "invalid"
  | "error"
  | "complete";

export default function MerchantCheckInPage() {
  const { data: session, isPending: isSessionPending } = useSession();
  const [mode, setMode] = useState<"manual" | "scanner">("manual");
  const [passId, setPassId] = useState("");
  const [result, setResult] = useState<VerifyPassResponse | null>(null);
  const [verificationMethod, setVerificationMethod] =
    useState<VerificationMethod>("MANUAL");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const controlsRef = useRef<IScannerControls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanLockedRef = useRef(false);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => stopScanner, [stopScanner]);

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

  async function verifyManualPass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPassId = passId.trim();
    if (!normalizedPassId || isVerifying) return;
    setIsVerifying(true);
    setError(null);
    setResult(null);
    setCheckedIn(false);
    setVerificationMethod("MANUAL");
    try {
      setResult(await apiClient.verifyPass(normalizedPassId));
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to verify this pass."));
    } finally {
      setIsVerifying(false);
    }
  }

  async function verifyScannedToken(token: string) {
    setScannerState("verifying");
    setError(null);
    setResult(null);
    setCheckedIn(false);
    setVerificationMethod("QR");
    try {
      setResult(await apiClient.verifyPassToken({ token }));
      setScannerState("complete");
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        if (caught.code === "QR_TOKEN_EXPIRED") {
          setScannerState("expired");
          setError("QR code expired. Ask the attendee to refresh the pass.");
          return;
        }
        if (caught.code === "INVALID_QR_TOKEN") {
          setScannerState("invalid");
          setError("Invalid QR code.");
          return;
        }
      }
      setScannerState("error");
      setError(toErrorMessage(caught, "Unable to verify this QR code."));
    }
  }

  async function startScanner() {
    if (scannerState === "starting" || scannerState === "scanning") return;
    stopScanner();
    setResult(null);
    setError(null);
    setCheckedIn(false);
    setScannerState("starting");
    scanLockedRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setScannerState("error");
      setError("Camera is unavailable. Use manual Pass ID instead.");
      return;
    }

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 1_000,
      });
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current,
        (scanResult, _scanError, callbackControls) => {
          if (!scanResult || scanLockedRef.current) return;
          scanLockedRef.current = true;
          callbackControls.stop();
          stopScanner();
          void verifyScannedToken(scanResult.getText());
        },
      );
      controlsRef.current = controls;
      if (scanLockedRef.current) controls.stop();
      else setScannerState("scanning");
    } catch (caught) {
      stopScanner();
      setScannerState("error");
      setError(cameraErrorMessage(caught));
    }
  }

  function changeMode(nextMode: "manual" | "scanner") {
    stopScanner();
    setMode(nextMode);
    setResult(null);
    setError(null);
    setCheckedIn(false);
    setScannerState("idle");
    scanLockedRef.current = false;
  }

  async function checkInPass() {
    if (!result?.canCheckIn || isCheckingIn) return;
    setIsCheckingIn(true);
    setError(null);
    try {
      setResult(
        await apiClient.checkInPass(result.pass.id, {
          method: verificationMethod,
        }),
      );
      setCheckedIn(true);
      setScannerState("complete");
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
            Scan a dynamic QR or use the Pass ID fallback. Verification remains
            read-only until confirmation.
          </p>
        </header>

        <div
          className="mt-8 inline-flex rounded-xl bg-zinc-200 p-1"
          role="tablist"
          aria-label="Verification method"
        >
          <ModeButton
            active={mode === "scanner"}
            onClick={() => changeMode("scanner")}
          >
            Scan QR
          </ModeButton>
          <ModeButton
            active={mode === "manual"}
            onClick={() => changeMode("manual")}
          >
            Manual Pass ID
          </ModeButton>
        </div>

        {mode === "manual" ? (
          <form
            className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            onSubmit={verifyManualPass}
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
        ) : (
          <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="overflow-hidden rounded-xl bg-zinc-950">
              <video
                className="aspect-video w-full object-cover"
                muted
                playsInline
                ref={videoRef}
              />
            </div>
            <p className="mt-3 text-sm text-zinc-600" aria-live="polite">
              {scannerStatusText(scannerState)}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {scannerState === "idle" ||
              scannerState === "error" ||
              scannerState === "expired" ||
              scannerState === "invalid" ||
              scannerState === "complete" ? (
                <button
                  className="rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white"
                  onClick={() => void startScanner()}
                  type="button"
                >
                  {scannerState === "complete"
                    ? "Scan next pass"
                    : "Start scanner"}
                </button>
              ) : null}
              <button
                className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium"
                onClick={() => changeMode("manual")}
                type="button"
              >
                Use manual Pass ID instead
              </button>
            </div>
          </section>
        )}

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

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`rounded-lg px-4 py-2 text-sm font-medium ${active ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600"}`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
    </button>
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

function scannerStatusText(state: ScannerState): string {
  if (state === "starting") return "Requesting camera access…";
  if (state === "scanning")
    return "Camera active. Hold the attendee QR code inside the frame.";
  if (state === "verifying") return "QR detected. Verifying…";
  if (state === "expired")
    return "QR expired. Ask the attendee to refresh their pass.";
  if (state === "invalid")
    return "Invalid QR. Scan a ChainPass verification code.";
  if (state === "complete")
    return "Scanner stopped. Review the result below or scan the next pass.";
  if (state === "error")
    return "Scanner unavailable. You can use the manual Pass ID fallback.";
  return "Start the scanner when the attendee is ready.";
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError")
    return "Camera permission denied. Allow camera access or use manual Pass ID instead.";
  if (
    error instanceof DOMException &&
    (error.name === "NotFoundError" || error.name === "OverconstrainedError")
  )
    return "No usable camera was found. Use manual Pass ID instead.";
  return "Unable to start the camera. Use manual Pass ID instead.";
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
    if (error.code === "PASS_ALREADY_CHECKED_IN")
      return "This pass has already been checked in.";
    return error.message;
  }
  return fallback;
}
