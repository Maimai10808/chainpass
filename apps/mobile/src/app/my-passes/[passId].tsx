import { ApiClientError } from "@chainpass/api-client";
import { getTransactionExplorerUrl, type Hash } from "@chainpass/web3";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  ActionButton,
  Card,
  ScreenState,
  StatusPill,
  layoutStyles,
} from "@/components/chainpass/ui";
import { useAppState } from "@/hooks/use-app-state";
import { useTheme } from "@/hooks/use-theme";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { formatEventDate, formatPrice } from "@/lib/format";
import { queryKeys } from "@/lib/query-client";

const TOKEN_REFRESH_LEAD_MS = 10_000;

export default function PassDetailScreen() {
  const { passId = "" } = useLocalSearchParams<{ passId: string }>();
  const theme = useTheme();
  const appState = useAppState();
  const { data: session, isPending: sessionPending } = useSession();
  const passes = useQuery({
    queryKey: queryKeys.myPasses,
    queryFn: () => apiClient.getMyPasses(),
    enabled: Boolean(session),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const refetchPasses = passes.refetch;
  const pass =
    passes.data?.find((candidate) => candidate.id === passId) ?? null;
  const token = useQuery({
    queryKey: queryKeys.passQr(passId),
    queryFn: () => apiClient.createPassVerificationToken(passId),
    enabled: Boolean(
      session && pass?.status === "ACTIVE" && appState === "active",
    ),
    retry: false,
    staleTime: 0,
  });
  const refetchToken = token.refetch;
  const tokenData = token.data;
  const [now, setNow] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (session) void refetchPasses();
    }, [refetchPasses, session]),
  );

  useEffect(() => {
    if (appState !== "active" || !tokenData || pass?.status !== "ACTIVE")
      return;
    const refreshIn =
      new Date(tokenData.expiresAt).getTime() -
      Date.now() -
      TOKEN_REFRESH_LEAD_MS;
    if (refreshIn <= 0) {
      void refetchToken();
      return;
    }
    const timeout = setTimeout(() => void refetchToken(), refreshIn);
    return () => clearTimeout(timeout);
  }, [appState, pass?.status, refetchToken, tokenData]);

  useEffect(() => {
    if (appState !== "active" || !tokenData || pass?.status !== "ACTIVE")
      return;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [appState, pass?.status, tokenData]);

  useEffect(() => {
    if (
      token.error instanceof ApiClientError &&
      token.error.code === "PASS_NOT_ACTIVE"
    ) {
      void refetchPasses();
    }
  }, [refetchPasses, token.error]);

  const secondsRemaining =
    tokenData && pass?.status === "ACTIVE" && now !== null
      ? Math.max(
          0,
          Math.ceil((new Date(tokenData.expiresAt).getTime() - now) / 1_000),
        )
      : null;
  const explorerUrl =
    pass?.chainId && pass.mintTxHash
      ? getTransactionExplorerUrl(pass.chainId, pass.mintTxHash as Hash)
      : null;

  if (sessionPending)
    return <ScreenState loading title="Restoring your session…" />;
  if (!session) {
    return (
      <ScreenState
        action={
          <ActionButton
            label="Sign in"
            onPress={() =>
              router.push({
                pathname: "/auth/sign-in",
                params: { returnTo: `/my-passes/${passId}` },
              })
            }
          />
        }
        description="Only the account owner can display this pass."
        title="Sign in required"
      />
    );
  }
  if (passes.isPending)
    return <ScreenState loading title="Loading your pass…" />;
  if (passes.isError) {
    return (
      <ScreenState
        action={
          <ActionButton label="Retry" onPress={() => void passes.refetch()} />
        }
        description="Check your connection and try again."
        title="Pass unavailable"
      />
    );
  }
  if (!pass) {
    return (
      <ScreenState
        action={
          <ActionButton
            label="Back to My Passes"
            onPress={() => router.replace("/my-passes")}
          />
        }
        description="This pass is not owned by your account."
        title="Pass not found"
      />
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={layoutStyles.scrollContent}
      style={[
        layoutStyles.screen,
        { backgroundColor: theme.backgroundElement },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.ticket, { color: theme.primary }]}>
          {pass.ticketType.name}
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>
          {pass.event.name}
        </Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {formatEventDate(pass.event.startsAt)} ·{" "}
          {pass.event.location ?? "Location to be announced"}
        </Text>
      </View>

      <Card>
        <View style={layoutStyles.spread}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Entry pass
          </Text>
          <StatusPill
            label={pass.status.replaceAll("_", " ")}
            tone={
              pass.status === "ACTIVE"
                ? "success"
                : pass.status === "REVOKED"
                  ? "danger"
                  : "warning"
            }
          />
        </View>
        {pass.status === "ACTIVE" ? (
          <View style={styles.qrArea}>
            {tokenData ? (
              <View style={styles.qrContent}>
                <View style={styles.qrFrame}>
                  <QRCode
                    backgroundColor="#FFFFFF"
                    color="#111827"
                    size={238}
                    value={tokenData.token}
                  />
                </View>
                <Text style={[styles.ready, { color: theme.success }]}>
                  READY TO USE
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  {secondsRemaining === null
                    ? "Secure code ready"
                    : `Refreshes in ${secondsRemaining}s`}
                </Text>
                {token.isFetching ? (
                  <Text style={[styles.meta, { color: theme.primary }]}>
                    Refreshing secure code…
                  </Text>
                ) : null}
              </View>
            ) : token.isPending ? (
              <ScreenState loading title="Preparing secure QR…" />
            ) : (
              <View style={styles.qrContent}>
                <Text style={[styles.sectionTitle, { color: theme.danger }]}>
                  QR unavailable
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  {token.error instanceof Error
                    ? token.error.message
                    : "Try requesting a new code."}
                </Text>
                <ActionButton
                  label="Retry"
                  onPress={() => void refetchToken()}
                />
              </View>
            )}
          </View>
        ) : pass.status === "CHECKED_IN" ? (
          <PassState
            title="CHECKED IN"
            description="This pass has already been used for entry."
          />
        ) : (
          <PassState
            title="REVOKED"
            description="This pass is no longer valid for entry."
          />
        )}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Pass details
        </Text>
        <Detail
          label="Holder"
          value={session.user.name || session.user.email}
        />
        <Detail label="Pass ID" value={pass.id} />
        <Detail label="Price" value={formatPrice(pass.ticketType.price)} />
        <Detail
          label="On-chain"
          value={pass.onChainStatus.replaceAll("_", " ")}
        />
        {pass.tokenId ? (
          <Detail label="Token ID" value={`#${pass.tokenId}`} />
        ) : null}
        {pass.contractAddress ? (
          <Detail label="Contract" value={pass.contractAddress} />
        ) : null}
        {explorerUrl ? (
          <ActionButton
            label="View transaction"
            onPress={() => void Linking.openURL(explorerUrl)}
            tone="secondary"
          />
        ) : null}
      </Card>
    </ScrollView>
  );
}

function PassState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.passState}>
      <Text style={[styles.passStateTitle, { color: theme.text }]}>
        {title}
      </Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {description}
      </Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.detail}>
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text selectable style={[styles.detailValue, { color: theme.text }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 7, paddingTop: 8 },
  ticket: { fontSize: 14, fontWeight: "700" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800" },
  meta: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: "700" },
  qrArea: { minHeight: 330, justifyContent: "center" },
  qrContent: { alignItems: "center", gap: 10 },
  qrFrame: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderCurve: "continuous",
    padding: 12,
  },
  ready: { fontSize: 13, fontWeight: "800", letterSpacing: 1.5 },
  passState: {
    minHeight: 240,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  passStateTitle: { fontSize: 26, fontWeight: "800" },
  detail: { gap: 3 },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  detailValue: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
});
