import { useEffect, useState } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { ApiClientError } from "@chainpass/api-client";
import { apiClient } from "@/lib/api-client";
import { keys, qrState, qrRefreshDelay } from "@/lib/product";
import { errorMessage } from "@/lib/errors";
import { useScreenActive } from "@/hooks/use-screen-active";
import { colors, radius, spacing } from "@/design";
import { ActionButton, Feedback, StatusPill, text } from "./ui";

export function QrPanel({
  passId,
  userId,
  status,
}: {
  passId: string;
  userId: string;
  status: string;
}) {
  const active = useScreenActive();
  const client = useQueryClient();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => Date.now());
  const token = useQuery({
    queryKey: keys.qr(userId, passId),
    queryFn: () => apiClient.createPassVerificationToken(passId),
    enabled: active && status === "ACTIVE",
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const { data, refetch, error } = token;
  useEffect(() => {
    if (!active || status !== "ACTIVE") {
      client.removeQueries({ queryKey: keys.qr(userId, passId) });
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, client, passId, status, userId]);
  useEffect(() => {
    if (!active || status !== "ACTIVE" || !data || error) return;
    const timer = setTimeout(
      () => void refetch(),
      qrRefreshDelay(data.expiresAt),
    );
    return () => clearTimeout(timer);
  }, [active, data, error, refetch, status]);
  useEffect(() => {
    if (error instanceof ApiClientError && error.code === "PASS_NOT_ACTIVE")
      void client.invalidateQueries({ queryKey: keys.passes(userId) });
  }, [client, error, userId]);
  const state = qrState(status, active, data?.expiresAt, now);
  if (state === "disabled")
    return (
      <Feedback
        tone={status === "CHECKED_IN" ? "info" : "danger"}
        message={
          status === "CHECKED_IN"
            ? "CHECKED IN — this pass has been used for entry."
            : "REVOKED — this pass is no longer valid for entry."
        }
      />
    );
  if (state === "paused")
    return (
      <Text style={text.body}>
        QR paused. Return to this screen to get a fresh code.
      </Text>
    );
  return (
    <View style={{ gap: spacing[16], alignItems: "center" }}>
      {state === "ready" && data ? (
        <>
          <View
            accessibilityLabel="Short-lived entry QR. Present to event staff."
            style={{
              padding: spacing[16],
              backgroundColor: colors.primaryForeground,
              borderRadius: radius.lg,
            }}
          >
            <QRCode
              value={data.token}
              size={Math.min(240, Math.max(160, width - 144))}
              color={colors.background}
              backgroundColor={colors.primaryForeground}
            />
          </View>
          <StatusPill label="READY TO USE" tone="success" />
          <Text style={text.caption}>
            {token.isFetching
              ? "Refreshing secure code…"
              : `Expires in ${Math.max(0, Math.ceil((Date.parse(data.expiresAt) - now) / 1000))}s`}
          </Text>
        </>
      ) : (
        <Text style={text.subheading}>
          {token.isFetching
            ? "Preparing secure QR…"
            : "QR expired / unavailable"}
        </Text>
      )}
      <Text style={[text.body, { textAlign: "center" }]}>
        For on-site verification only. The code rotates automatically; a saved
        screenshot expires.
      </Text>
      {token.isError && <Feedback message={errorMessage(token.error)} />}
      {(token.isError || state === "expired") && (
        <ActionButton
          label="Refresh QR"
          loading={token.isFetching}
          onPress={() => void refetch()}
        />
      )}
    </View>
  );
}
