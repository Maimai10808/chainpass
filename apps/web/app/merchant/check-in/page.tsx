"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { useMutation } from "@tanstack/react-query";
import { ApiClientError, type VerifyPassResponse } from "@chainpass/api-client";
import type { CheckInMethod } from "@chainpass/schemas";
import { toast } from "sonner";
import { Camera, ScanLine, CheckCircle2, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { apiClient } from "@/lib/api-client";
import { formatDate, errorMessage } from "@/lib/presentation";
import { getMotionTransition } from "@/lib/design/motion";
import {
  PageHeading,
  Detail,
  StatusBadge,
} from "@/components/chainpass/page-kit";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type ScanState = "idle" | "starting" | "scanning" | "stopped";
export default function MerchantCheckInPage() {
  const [mode, setMode] = useState("manual");
  const [passId, setPassId] = useState("");
  const [result, setResult] = useState<VerifyPassResponse | null>(null);
  const [method, setMethod] = useState<CheckInMethod>("MANUAL");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const controls = useRef<IScannerControls | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const epoch = useRef(0);
  const locked = useRef(false);
  const reduced = useReducedMotion();
  const stop = useCallback(() => {
    epoch.current += 1;
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject;
    if (stream instanceof MediaStream)
      stream.getTracks().forEach((track) => track.stop());
    if (video.current) video.current.srcObject = null;
  }, []);
  useEffect(() => stop, [stop]);
  const verify = useMutation({
    mutationFn: ({
      value,
      method: source,
    }: {
      value: string;
      method: CheckInMethod;
    }) =>
      source === "QR"
        ? apiClient.verifyPassToken({ token: value })
        : apiClient.verifyPass(value),
    onSuccess: (data, variables) => {
      setResult(data);
      setMethod(variables.method);
    },
    onError: (error) => toast.error(verificationError(error)),
  });
  const check = useMutation({
    mutationFn: () => {
      if (!result?.canCheckIn) throw new Error("Verify an active pass first");
      return apiClient.checkInPass(result.pass.id, { method });
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("Checked in. Welcome to the experience.");
    },
    onError: async (error) => {
      toast.error(verificationError(error));
      if (
        error instanceof ApiClientError &&
        error.code === "PASS_ALREADY_CHECKED_IN" &&
        result
      ) {
        try {
          setResult(await apiClient.verifyPass(result.pass.id));
        } catch {
          /* The original conflict remains visible. */
        }
      }
    },
  });
  const busy = verify.isPending || check.isPending;
  function begin(value: string, source: CheckInMethod) {
    if (busy) return;
    setResult(null);
    check.reset();
    verify.mutate({ value, method: source });
  }
  function changeMode(value: string) {
    if (busy) return;
    stop();
    setMode(value);
    setResult(null);
    setCameraError(null);
    setScanState("idle");
    verify.reset();
    check.reset();
  }
  async function startCamera() {
    if (busy || scanState === "starting" || scanState === "scanning") return;
    stop();
    const run = epoch.current;
    setResult(null);
    verify.reset();
    check.reset();
    setCameraError(null);
    setScanState("starting");
    locked.current = false;
    const target = video.current;
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !target
    ) {
      setCameraError(
        "Camera requires HTTPS (or localhost) and a supported device. Manual Pass ID is always available.",
      );
      setScanState("stopped");
      return;
    }
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (epoch.current !== run) return;
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 1_000,
      });
      const scanner = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        target,
        (decoded, _error, scannerControls) => {
          if (!decoded || locked.current || epoch.current !== run) return;
          locked.current = true;
          scannerControls.stop();
          stop();
          setScanState("stopped");
          begin(decoded.getText(), "QR");
        },
      );
      if (epoch.current !== run || locked.current) scanner.stop();
      else {
        controls.current = scanner;
        setScanState("scanning");
      }
    } catch (error) {
      if (epoch.current !== run) return;
      stop();
      setCameraError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission denied. Allow access or use Manual Pass ID."
          : error instanceof DOMException && error.name === "NotFoundError"
            ? "No camera found. Use Manual Pass ID."
            : "Camera could not start. Use Manual Pass ID instead.",
      );
      setScanState("stopped");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Merchant / gate operations"
        title="A smooth entrance."
        description="Verify first. Confirm check-in once. Camera and manual entry use the same secure business flow."
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="size-5 text-primary" />
              Verify a pass
            </CardTitle>
            <CardDescription>
              Only passes for your events can be checked in. Admins can verify
              any event.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={changeMode}>
              <TabsList className="mb-6">
                <TabsTrigger value="manual" disabled={busy}>
                  Manual Pass ID
                </TabsTrigger>
                <TabsTrigger value="scanner" disabled={busy}>
                  Scan QR
                </TabsTrigger>
              </TabsList>
              <TabsContent value="manual">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (passId.trim()) begin(passId.trim(), "MANUAL");
                  }}
                >
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="pass-id">Pass ID</FieldLabel>
                      <Input
                        id="pass-id"
                        placeholder="Paste the attendee's pass ID"
                        value={passId}
                        disabled={busy}
                        onChange={(event) => setPassId(event.target.value)}
                        required
                      />
                    </Field>
                    <Button
                      className="h-11"
                      type="submit"
                      disabled={busy || !passId.trim()}
                    >
                      {verify.isPending && <Spinner data-icon="inline-start" />}
                      Verify pass
                    </Button>
                  </FieldGroup>
                </form>
              </TabsContent>
              <TabsContent value="scanner">
                <div className="relative overflow-hidden rounded-xl border border-border bg-background">
                  <video
                    className="aspect-video w-full object-cover"
                    ref={video}
                    muted
                    playsInline
                    aria-label="QR scanning camera"
                  />
                  {scanState !== "scanning" && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <Camera className="size-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p
                  className="mt-4 text-body-sm text-muted-foreground"
                  aria-live="polite"
                >
                  {verify.isPending
                    ? "QR detected. Verifying…"
                    : scanState === "starting"
                      ? "Requesting camera access…"
                      : scanState === "scanning"
                        ? "Hold the attendee QR inside the frame."
                        : "Camera is stopped. Start when the next attendee is ready."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {scanState === "scanning" || scanState === "starting" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        stop();
                        setScanState("stopped");
                      }}
                    >
                      Stop camera
                    </Button>
                  ) : (
                    <Button disabled={busy} onClick={() => void startCamera()}>
                      {result ? "Scan next pass" : "Start scanner"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => changeMode("manual")}
                  >
                    Use manual instead
                  </Button>
                </div>
                {cameraError && (
                  <Alert className="mt-4">
                    <AlertTitle>Camera unavailable</AlertTitle>
                    <AlertDescription>{cameraError}</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
            {(verify.isError || check.isError) && (
              <Alert className="mt-5" variant="destructive">
                <AlertTitle>
                  {verify.error instanceof ApiClientError &&
                  verify.error.code === "QR_TOKEN_EXPIRED"
                    ? "QR EXPIRED"
                    : verify.error instanceof ApiClientError &&
                        verify.error.code === "INVALID_QR_TOKEN"
                      ? "INVALID QR"
                      : "Action unsuccessful"}
                </AlertTitle>
                <AlertDescription>
                  {verificationError(check.error ?? verify.error)}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        {result ? (
          <motion.div
            key={result.pass.id + result.pass.status}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={getMotionTransition(Boolean(reduced))}
          >
            <Card>
              <CardHeader>
                <p className="mb-3 flex items-center gap-2 text-info">
                  {result.verificationStatus === "ALREADY_CHECKED_IN" ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <ShieldCheck className="size-5" />
                  )}
                  {check.isSuccess
                    ? "CHECKED IN ✓"
                    : result.verificationStatus.replaceAll("_", " ")}
                </p>
                <CardTitle className="text-h3">{result.event.name}</CardTitle>
                <CardDescription>{result.ticketType.name}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <StatusBadge status={result.pass.status} />
                <dl className="grid gap-5 sm:grid-cols-2">
                  <Detail label="Holder">{result.holder.name}</Detail>
                  <Detail label="Email">{result.holder.email}</Detail>
                  <Detail label="Event time">
                    {formatDate(result.event.startsAt)}
                  </Detail>
                  <Detail label="Location">
                    {result.event.location ?? "TBA"}
                  </Detail>
                  <Detail label="Blockchain">
                    {result.onChainStatus.replaceAll("_", " ")}
                  </Detail>
                  <Detail label="Token ID" mono>
                    {result.pass.tokenId ?? "Not minted"}
                  </Detail>
                  <Detail label="Pass serial" mono>
                    {result.pass.id}
                  </Detail>
                </dl>
                {result.onChainStatus === "UNAVAILABLE" && (
                  <Alert>
                    <AlertTitle>Blockchain unavailable</AlertTitle>
                    <AlertDescription>
                      Database verification is authoritative. Valid passes can
                      still check in.
                    </AlertDescription>
                  </Alert>
                )}
                {result.checkIn && (
                  <div className="rounded-lg border border-info/20 bg-info/5 p-4">
                    <p className="text-info">Already checked in</p>
                    <p className="mt-2 text-body-sm text-muted-foreground">
                      {formatDate(result.checkIn.verifiedAt)} ·{" "}
                      {result.checkIn.verifiedBy.name} · {result.checkIn.method}
                    </p>
                  </div>
                )}
                {result.canCheckIn && (
                  <Button
                    className="h-12 w-full"
                    disabled={busy}
                    onClick={() => check.mutate()}
                  >
                    {check.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <CheckCircle2 data-icon="inline-start" />
                    )}
                    {check.isPending ? "Checking in…" : "Confirm check-in"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setResult(null);
                    setPassId("");
                    verify.reset();
                    check.reset();
                    if (mode === "scanner") void startCamera();
                  }}
                >
                  Next attendee
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-8 text-center">
            <ShieldCheck className="size-10 text-muted-foreground" />
            <h2 className="text-h3 font-semibold">
              Ready for the next attendee
            </h2>
            <p className="max-w-xs text-body-sm text-muted-foreground">
              The verified pass appears here. No check-in happens until you
              confirm.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
function verificationError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "QR_TOKEN_EXPIRED")
      return "QR code expired. Ask the attendee to refresh the pass and scan again.";
    if (error.code === "INVALID_QR_TOKEN")
      return "Invalid QR. Scan a ChainPass verification code.";
    if (error.status === 404)
      return "Pass not found. Check the ID and try again.";
    if (error.status === 403)
      return "This pass is not from an event you can manage.";
    if (error.code === "PASS_ALREADY_CHECKED_IN")
      return "This pass is already checked in.";
  }
  return errorMessage(error);
}
