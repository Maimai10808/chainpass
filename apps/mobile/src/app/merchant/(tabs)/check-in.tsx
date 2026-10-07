import { useRef, useState, useEffect } from "react";
import { Linking, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CheckInMethod, VerifyPassResponse } from "@chainpass/schemas";
import Animated, { FadeIn } from "react-native-reanimated";
import { CheckCircle2, ScanLine } from "lucide-react-native";
import { apiClient } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { canConfirmCheckIn, cameraShouldRun } from "@/lib/product";
import { useScreenActive } from "@/hooks/use-screen-active";
import {
  colors,
  tones,
  duration,
  radius,
  triggerHaptic,
  useReducedMotionPreference,
} from "@/design";
import {
  Screen,
  Heading,
  Card,
  Field,
  FilterBar,
  Fact,
  StatusPill,
  ActionButton,
  Feedback,
  text,
  layoutStyles,
} from "@/components/chainpass/ui";

export default function CheckIn() {
  const active = useScreenActive();
  const reduced = useReducedMotionPreference();
  const client = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState("Scan QR");
  const [passId, setPassId] = useState("");
  const [result, setResult] = useState<VerifyPassResponse | null>(null);
  const [method, setMethod] = useState<CheckInMethod>("QR");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [validation, setValidation] = useState("");
  const [success, setSuccess] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  // Never apply a scan response to a new scan/mode/session after a lifecycle change.
  useEffect(() => {
    if (!active) {
      generation.current++;
      lock.current = false;
    }
  }, [active]);
  const verify = useMutation({
    mutationFn: async (input: {
      value: string;
      method: CheckInMethod;
      generation: number;
    }) => ({
      data:
        input.method === "QR"
          ? await apiClient.verifyPassToken({ token: input.value })
          : await apiClient.verifyPass(input.value),
      input,
    }),
    onSuccess: ({ data, input }) => {
      if (input.generation !== generation.current) return;
      setResult(data);
      setMethod(input.method);
      void triggerHaptic(canConfirmCheckIn(data) ? "light" : "warning");
    },
    onError: () => {
      void triggerHaptic("error");
    },
  });
  const checkIn = useMutation({
    mutationFn: () => apiClient.checkInPass(result!.pass.id, { method }),
    onSuccess: (data) => {
      setResult(data);
      setSuccess(true);
      void client.invalidateQueries({ queryKey: ["private"] });
      void triggerHaptic("success");
    },
    onError: () => {
      void triggerHaptic("error");
    },
  });
  function reset() {
    generation.current++;
    lock.current = false;
    setResult(null);
    setSuccess(false);
    setScanning(false);
    setValidation("");
    verify.reset();
    checkIn.reset();
  }
  function submit(value: string, nextMethod: CheckInMethod) {
    if (lock.current || checkIn.isPending || !active) return;
    if (!value.trim()) {
      setValidation("Enter a Pass ID before verifying.");
      return;
    }
    lock.current = true;
    setValidation("");
    setScanning(false);
    setResult(null);
    setSuccess(false);
    verify.mutate({
      value: value.trim(),
      method: nextMethod,
      generation: generation.current,
    });
  }
  const running = cameraShouldRun(
    active,
    active,
    permission?.granted === true,
    mode === "Scan QR" &&
      scanning &&
      !verify.isPending &&
      !result &&
      !cameraError,
  );
  return (
    <Screen keyboard>
      <Heading
        eyebrow="MERCHANT / FRONT DOOR"
        title="Welcome them in."
        description="Verify first. Confirm entry only when you’re ready."
      />
      <FilterBar
        values={["Scan QR", "Manual"]}
        value={mode}
        onChange={(next) => {
          if (checkIn.isPending) return;
          reset();
          setMode(next);
        }}
      />
      {!result &&
        !verify.isPending &&
        !verify.isError &&
        (mode === "Manual" ? (
          <Card>
            <Field
              label="Pass ID"
              placeholder="Paste or enter a pass ID"
              autoCapitalize="none"
              value={passId}
              onChangeText={setPassId}
              onSubmitEditing={() => submit(passId, "MANUAL")}
            />
            {Boolean(validation) && <Feedback message={validation} />}
            <ActionButton
              label="Verify pass"
              onPress={() => submit(passId, "MANUAL")}
            />
          </Card>
        ) : (
          <Card>
            <View
              style={{
                aspectRatio: 1,
                backgroundColor: colors.surface[2],
                borderRadius: radius.xl,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {running ? (
                <>
                  <CameraView
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "100%",
                    }}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={({ data }) => submit(data, "QR")}
                    onMountError={() => {
                      setCameraError(
                        "Camera could not start. Close other camera apps or use manual verification.",
                      );
                      setScanning(false);
                    }}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      width: "72%",
                      aspectRatio: 1,
                      borderWidth: 2,
                      borderColor: colors.brand.cyan,
                      borderRadius: radius.lg,
                    }}
                  />
                </>
              ) : (
                <ScanLine
                  size={64}
                  color={colors.brand.cyan}
                  accessibilityLabel="Camera scanner paused"
                />
              )}
            </View>
            <Text style={text.body}>
              {running
                ? "Keep the attendee’s QR inside the frame."
                : "Start the camera to scan a ChainPass QR. The camera pauses as soon as one code is detected."}
            </Text>
            {permission && !permission.granted ? (
              <>
                <Feedback
                  tone="warning"
                  message="Camera permission is needed for QR scanning. Manual verification is always available."
                />
                <ActionButton
                  label={
                    permission.canAskAgain ? "Allow camera" : "Open settings"
                  }
                  onPress={() => {
                    if (permission.canAskAgain)
                      void requestPermission().catch(() =>
                        setCameraError(
                          "Camera permission unavailable. Use manual verification.",
                        ),
                      );
                    else void Linking.openSettings().catch(() => {});
                  }}
                />
              </>
            ) : (
              <ActionButton
                label={scanning ? "Pause scanner" : "Start scanner"}
                disabled={!active || !permission?.granted}
                onPress={() => {
                  setCameraError("");
                  setScanning(!scanning);
                }}
              />
            )}
            {Boolean(cameraError) && <Feedback message={cameraError} />}
            <ActionButton
              tone="secondary"
              label="Use manual Pass ID"
              onPress={() => {
                reset();
                setMode("Manual");
              }}
            />
          </Card>
        ))}
      {verify.isPending && (
        <Card>
          <Text style={text.heading}>Verifying…</Text>
          <Text style={text.body}>
            Checking the current pass status and event ownership.
          </Text>
        </Card>
      )}
      {verify.isError && (
        <Card>
          <StatusPill label="VERIFICATION FAILED" tone="danger" />
          <Feedback message={errorMessage(verify.error)} />
          <ActionButton label="Try again" onPress={reset} />
          <ActionButton
            tone="secondary"
            label="Use manual verification"
            onPress={() => {
              reset();
              setMode("Manual");
            }}
          />
        </Card>
      )}
      {result && (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(duration.normal)}
        >
          <Card>
            {success && (
              <CheckCircle2
                color={colors.brand.cyan}
                size={64}
                accessibilityLabel="Check-in successful"
              />
            )}
            <StatusPill
              label={success ? "CHECKED IN" : result.verificationStatus}
              tone={
                result.verificationStatus === "VALID"
                  ? "success"
                  : result.verificationStatus === "ALREADY_CHECKED_IN"
                    ? "info"
                    : "danger"
              }
            />
            <Text style={text.heading}>{result.event.name}</Text>
            <Fact label="Ticket" value={result.ticketType.name} />
            <Fact label="Holder" value={result.holder.name} />
            <Fact label="Email" value={result.holder.email} />
            <View style={layoutStyles.row}>
              <StatusPill
                label={result.pass.status}
                tone={
                  result.pass.status === "ACTIVE"
                    ? "success"
                    : result.pass.status === "CHECKED_IN"
                      ? "info"
                      : "danger"
                }
              />
              <StatusPill
                label={`CHAIN: ${result.onChainStatus}`}
                tone={result.onChainStatus === "VERIFIED" ? "info" : "neutral"}
              />
            </View>
            {result.pass.tokenId && (
              <Fact label="Token ID" value={`#${result.pass.tokenId}`} mono />
            )}
            <Fact label="Pass ID" value={result.pass.id} mono />
            {(result.onChainStatus === "UNAVAILABLE" ||
              result.onChainStatus === "MISMATCH") && (
              <Feedback
                tone="warning"
                message="On-chain proof is not confirmed. The server’s current business verification remains the authority for entry."
              />
            )}
            {result.checkIn && (
              <>
                <Fact
                  label="Checked in"
                  value={new Date(result.checkIn.verifiedAt).toLocaleString()}
                />
                <Fact
                  label="Verified by"
                  value={result.checkIn.verifiedBy.name}
                />
                <Fact label="Method" value={result.checkIn.method} />
              </>
            )}
            {checkIn.isError && (
              <Feedback message={errorMessage(checkIn.error)} />
            )}
            {canConfirmCheckIn(result) && !success && (
              <ActionButton
                label="Confirm check-in"
                loading={checkIn.isPending}
                onPress={() => checkIn.mutate()}
              />
            )}
            <ActionButton
              label={
                mode === "Scan QR" ? "Scan next pass" : "Verify another pass"
              }
              tone="secondary"
              disabled={checkIn.isPending}
              onPress={() => {
                reset();
                setPassId("");
                if (mode === "Scan QR" && permission?.granted)
                  setScanning(true);
              }}
            />
          </Card>
        </Animated.View>
      )}
      <Text style={[text.caption, { color: tones.neutral.foreground }]}>
        A scan never checks someone in automatically. Pass state and merchant
        ownership are rechecked by the server.
      </Text>
    </Screen>
  );
}
