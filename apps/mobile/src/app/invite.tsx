import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@chainpass/api-client";
import { apiClient } from "@/lib/api-client";
import { authClient, useSession } from "@/lib/auth-client";
import { errorMessage } from "@/lib/errors";
import { getRole, keys } from "@/lib/product";
import { formatEventDate, formatPrice } from "@/lib/format";
import {
  invitationTokenFromHash,
  invitationTokenFromLink,
} from "@/lib/invitation-link";
import {
  pendingInvitation,
  usePendingInvitation,
} from "@/lib/pending-invitation";
import { PENDING_INVITATION_RETENTION_MS } from "@/lib/pending-invitation-store";
import { useScreenActive } from "@/hooks/use-screen-active";
import { useActiveClock } from "@/hooks/use-active-clock";
import { radius, triggerHaptic } from "@/design";
import {
  ActionButton,
  Card,
  Fact,
  Feedback,
  Field,
  Heading,
  Screen,
  ScreenState,
  StatusPill,
  layoutStyles,
  text,
} from "@/components/chainpass/ui";

const reasons = {
  missing: "Paste the complete invitation link your organizer shared with you.",
  invalid: "Invalid invitation. Ask the organizer for a complete, valid link.",
  expired:
    "This invitation or its saved handoff expired. Reopen the original link or ask for a new one.",
  revoked:
    "The organizer revoked this invitation. Already issued passes remain valid.",
  exhausted: "This invitation has reached its claim limit.",
  unavailable:
    "This invitation is no longer available. Ask the organizer for a new link.",
};

export default function InvitationScreen() {
  const { "#": hash } = useLocalSearchParams<{ "#"?: string | string[] }>();
  const pending = usePendingInvitation();
  const [link, setLink] = useState("");
  useEffect(() => {
    if (hash === undefined || hash === "") return;
    void pendingInvitation.accept(
      typeof hash === "string" ? invitationTokenFromHash(hash) : null,
    );
    // Auth and screen history only keep /invite, not a bearer credential.
    router.replace("/invite");
  }, [hash]);
  if (!pending.ready || (hash !== undefined && hash !== ""))
    return <ScreenState loading title="Opening invitation…" />;
  if (pending.value)
    return (
      <InvitationClaim
        key={pending.revision}
        revision={pending.revision}
        token={pending.value.token}
        storedAt={pending.value.storedAt}
        persistent={pending.persistent}
      />
    );
  return (
    <Screen keyboard>
      <Heading
        eyebrow="INVITATION"
        title="You're invited."
        description="Invitation-only events are not listed in Discover. Open your organizer's link to see its designated ticket."
      />
      <Card>
        <Feedback
          tone={pending.reason === "missing" ? "info" : "warning"}
          message={reasons[pending.reason]}
        />
        <Field
          label="Invitation link"
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="Paste your complete invitation link"
        />
        <ActionButton
          label="Open invitation"
          disabled={!link.trim()}
          onPress={() => {
            void pendingInvitation.accept(
              invitationTokenFromLink(link, process.env.EXPO_PUBLIC_APP_URL),
            );
            setLink("");
          }}
        />
      </Card>
      <ActionButton
        tone="secondary"
        label="Browse public events"
        onPress={() => router.replace("/")}
      />
      <ActionButton
        tone="secondary"
        label="Already claimed? My Passes"
        onPress={openPasses}
      />
    </Screen>
  );
}

function openPasses() {
  router.push("/my-passes");
}

function InvitationClaim({
  token,
  revision,
  storedAt,
  persistent,
}: {
  token: string;
  revision: number;
  storedAt: number;
  persistent: boolean;
}) {
  const { data: session } = useSession();
  const active = useScreenActive();
  const client = useQueryClient();
  const now = useActiveClock(active);
  const uid = session?.user.id;
  const preview = useQuery({
    // Opaque per-open identity, not the secret, keeps preview caches isolated.
    queryKey: ["invitation-preview", revision, uid ?? "anonymous"],
    queryFn: () => apiClient.resolveInvitation({ token }),
    enabled: active,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: active ? 30_000 : false,
    refetchOnWindowFocus: "always",
  });
  useEffect(() => {
    if (preview.data)
      void pendingInvitation.setExpiry(token, preview.data.expiresAt);
  }, [preview.data, token]);
  useEffect(() => {
    if (pendingInvitation.getSnapshot().revision !== revision) return;
    if (
      now - storedAt >= PENDING_INVITATION_RETENTION_MS ||
      (preview.data && Date.parse(preview.data.expiresAt) <= now)
    ) {
      void pendingInvitation.clear("expired");
    }
  }, [now, storedAt, preview.data, revision]);
  useEffect(() => {
    if (
      !(preview.error instanceof ApiClientError) ||
      pendingInvitation.getSnapshot().revision !== revision
    )
      return;
    const terminal = {
      INVALID_INVITATION: "invalid",
      INVITATION_EXPIRED: "expired",
      INVITATION_REVOKED: "revoked",
      INVITATION_EXHAUSTED: "exhausted",
      INVITATION_UNAVAILABLE: "unavailable",
    } as const;
    const reason = terminal[preview.error.code as keyof typeof terminal];
    if (reason) void pendingInvitation.clear(reason);
  }, [preview.error, revision]);
  function authenticate() {
    router.push({ pathname: "/auth/sign-in", params: { returnTo: "/invite" } });
  }
  const claim = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const fresh = await authClient.getSession({
        query: { disableCookieCache: true },
      });
      if (!uid || fresh.data?.user.id !== uid)
        throw new Error("Session changed");
      return apiClient.claimPass(preview.data!.ticketType.id, {
        invitationToken: token,
      });
    },
    onSuccess: async (result) => {
      void client.invalidateQueries({ queryKey: keys.passes(uid!) });
      if (pendingInvitation.getSnapshot().revision !== revision) return;
      const fresh = await authClient.getSession({
        query: { disableCookieCache: true },
      });
      if (
        fresh.data?.user.id !== uid ||
        pendingInvitation.getSnapshot().revision !== revision
      )
        return;
      await pendingInvitation.clear();
      void triggerHaptic("success");
      router.replace({
        pathname: "/my-passes/[passId]",
        params: { passId: result.pass.id },
      });
    },
    onError: (error) => {
      if (pendingInvitation.getSnapshot().revision !== revision) return;
      if (error instanceof ApiClientError && error.status === 401)
        authenticate();
      void preview.refetch();
      void triggerHaptic("error");
    },
  });
  if (preview.isPending)
    return <ScreenState loading title="Loading your invitation…" />;
  if (preview.isError || !preview.data)
    return (
      <Screen>
        <Heading
          title="Invitation unavailable"
          description="No pass has been claimed."
        />
        <Feedback message={errorMessage(preview.error)} />
        <ActionButton label="Retry" onPress={() => void preview.refetch()} />
        <ActionButton
          tone="secondary"
          label="Clear invitation"
          onPress={() => void pendingInvitation.clear()}
        />
        <ActionButton tone="secondary" label="My Passes" onPress={openPasses} />
      </Screen>
    );
  const { event, ticketType, remainingUses, expiresAt } = preview.data;
  const eligible = !session || getRole(session.user) !== "merchant";
  const expired = Date.parse(expiresAt) <= now;
  const duplicate =
    claim.error instanceof ApiClientError &&
    claim.error.code === "PASS_ALREADY_CLAIMED";
  return (
    <Screen>
      <Heading
        eyebrow="YOU'RE INVITED"
        title={event.name}
        description={event.description ?? undefined}
      />
      {event.coverImageUrl ? (
        <Image
          source={{ uri: event.coverImageUrl }}
          contentFit="cover"
          style={{ height: 210, borderRadius: radius.xl }}
        />
      ) : null}
      <Card>
        <StatusPill label="INVITATION ONLY" tone="info" />
        <Text style={text.heading}>{ticketType.name}</Text>
        {ticketType.description ? (
          <Text style={text.body}>{ticketType.description}</Text>
        ) : null}
        <Fact label="Organizer" value={event.organizer.name} />
        <Fact label="Schedule" value={formatEventDate(event.startsAt)} />
        <Fact label="Location" value={event.location ?? "To be announced"} />
        <Fact label="Price" value={formatPrice(ticketType.price)} />
        <Fact
          label="Availability"
          value={`${ticketType.remaining} tickets · ${remainingUses} invitation claims remaining`}
        />
        <Fact label="Invitation expires" value={formatEventDate(expiresAt)} />
        <Text style={text.caption}>
          This forwardable link is not a ticket or check-in QR. Claim creates
          your own Pass. Availability is checked again by the server.
        </Text>
        {!persistent ? (
          <Feedback
            tone="warning"
            message="Secure storage is unavailable. Keep the app open while signing in, or reopen the original link."
          />
        ) : null}
        {!eligible ? (
          <Feedback
            tone="warning"
            message="Merchant accounts manage events. Use an attendee account to claim a pass."
          />
        ) : null}
        {claim.isError ? (
          <Feedback message={errorMessage(claim.error)} />
        ) : null}
        <View style={layoutStyles.section}>
          {duplicate ? (
            <ActionButton
              label="View your existing passes"
              onPress={openPasses}
            />
          ) : (
            <ActionButton
              label={
                !session
                  ? "Sign in to claim"
                  : ticketType.remaining === 0
                    ? "Sold out"
                    : "Claim your pass"
              }
              disabled={
                !active ||
                !eligible ||
                expired ||
                ticketType.remaining === 0 ||
                remainingUses === 0
              }
              loading={claim.isPending}
              onPress={() => (session ? claim.mutate() : authenticate())}
            />
          )}
          <ActionButton
            tone="secondary"
            label="Refresh invitation"
            disabled={claim.isPending}
            onPress={() => void preview.refetch()}
          />
          <ActionButton
            tone="secondary"
            label="Clear invitation"
            disabled={claim.isPending}
            onPress={() => void pendingInvitation.clear()}
          />
        </View>
      </Card>
    </Screen>
  );
}
