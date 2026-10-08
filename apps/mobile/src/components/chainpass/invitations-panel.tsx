import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Share, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvitationInputSchema,
  type CreateInvitationInput,
  type InvitationView,
  type TicketTypeResponse,
} from "@chainpass/schemas";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { keys } from "@/lib/product";
import { errorMessage } from "@/lib/errors";
import { formatEventDate } from "@/lib/format";
import { invitationLink, nativeInvitationLink } from "@/lib/invitation-link";
import { useScreenActive } from "@/hooks/use-screen-active";
import { useActiveClock } from "@/hooks/use-active-clock";
import { triggerHaptic } from "@/design";
import { DateField } from "./date-field";
import {
  ActionButton,
  Card,
  Fact,
  Feedback,
  Field,
  Sheet,
  StatusPill,
  layoutStyles,
  text,
} from "./ui";

export function InvitationsPanel({
  eventId,
  tickets,
}: {
  eventId: string;
  tickets: TicketTypeResponse[];
}) {
  const { data: session } = useSession();
  const uid = session!.user.id;
  const cache = useQueryClient();
  const active = useScreenActive();
  const now = useActiveClock(active);
  const [ticketId, setTicketId] = useState("");
  const [limit, setLimit] = useState("10");
  const [expiry, setExpiry] = useState(
    () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  );
  const [validation, setValidation] = useState("");
  const [shareError, setShareError] = useState("");
  const [latest, setLatest] = useState<{
    id: string;
    url: string;
    nativeUrl: string;
  } | null>(null);
  const [target, setTarget] = useState<InvitationView | null>(null);
  const key = keys.invitations(uid, eventId);
  const links = useQuery({
    queryKey: key,
    queryFn: () => apiClient.listInvitations(eventId),
    enabled: active,
    refetchInterval: active ? 30_000 : false,
  });
  const activeTickets = tickets.filter((ticket) => ticket.status === "ACTIVE");
  const origin = process.env.EXPO_PUBLIC_APP_URL;
  let configured = false;
  try {
    if (origin) {
      const url = new URL(origin);
      configured =
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password;
    }
  } catch {
    /* Disable creation until a real public origin is configured. */
  }
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        setLatest(null);
      };
    }, []),
  );
  const create = useMutation({
    mutationFn: (input: CreateInvitationInput) =>
      apiClient.createInvitation(eventId, input),
    gcTime: 0,
    onSuccess: ({ invitation, token }) => {
      // Raw credentials live in this screen only, never a list query cache.
      if (focused.current)
        setLatest({
          id: invitation.id,
          url: invitationLink(origin!, token),
          nativeUrl: nativeInvitationLink(token),
        });
      void cache.invalidateQueries({ queryKey: key });
      create.reset();
      void triggerHaptic("success");
    },
  });
  const revoke = useMutation({
    mutationFn: apiClient.revokeInvitation,
    onSuccess: (result) => {
      if (latest?.id === result.id) setLatest(null);
      setTarget(null);
      void cache.invalidateQueries({ queryKey: key });
      void triggerHaptic("success");
    },
  });
  function submit() {
    if (create.isPending || !configured) return;
    const result = createInvitationInputSchema.safeParse({
      ticketTypeId: ticketId,
      maxUses: /^\d+$/.test(limit) ? Number(limit) : NaN,
      expiresAt: expiry.toISOString(),
    });
    if (
      !result.success ||
      expiry.getTime() <= now ||
      !activeTickets.some((ticket) => ticket.id === ticketId)
    ) {
      setValidation(
        "Choose an active ticket, a positive whole-number claim limit and a future expiry.",
      );
      return;
    }
    setValidation("");
    setShareError("");
    create.mutate(result.data);
  }
  async function share(url: string) {
    setShareError("");
    try {
      await Share.share({
        message: `You're invited to ChainPass. Open this link to claim your own pass:\n${url}`,
      });
    } catch {
      setShareError(
        "Sharing is unavailable. Select and copy the link shown below.",
      );
    }
  }
  return (
    <View style={layoutStyles.section}>
      <Text accessibilityRole="header" style={text.heading}>
        Invitations
      </Text>
      <Card>
        <Text style={text.subheading}>Create a shareable invitation</Text>
        <Text style={text.body}>
          Anyone with the link can sign in and claim this one ticket type. Claim
          limits share ticket inventory; they do not reserve stock.
        </Text>
        <Text style={text.label}>Ticket type</Text>
        {activeTickets.map((ticket) => (
          <ActionButton
            key={ticket.id}
            tone={ticket.id === ticketId ? "primary" : "secondary"}
            label={`${ticket.id === ticketId ? "Selected: " : ""}${ticket.name} · ${ticket.totalSupply - ticket.claimedCount} remaining`}
            disabled={create.isPending}
            accessibilityState={{ selected: ticket.id === ticketId }}
            onPress={() => setTicketId(ticket.id)}
          />
        ))}
        {!activeTickets.length ? (
          <Text style={text.body}>Create an active ticket type first.</Text>
        ) : null}
        <Field
          label="Maximum successful claims"
          value={limit}
          onChangeText={setLimit}
          keyboardType="number-pad"
          editable={!create.isPending}
        />
        <DateField
          label="Invitation expires"
          value={expiry}
          onChange={setExpiry}
        />
        {!configured ? (
          <Feedback
            tone="warning"
            message="Set EXPO_PUBLIC_APP_URL to the real Web origin before creating shareable invitations."
          />
        ) : null}
        {validation ? <Feedback message={validation} /> : null}
        {create.isError ? (
          <Feedback message={errorMessage(create.error)} />
        ) : null}
        <ActionButton
          label="Create invitation"
          loading={create.isPending}
          disabled={!configured || !activeTickets.length}
          onPress={submit}
        />
        <Text style={text.caption}>
          Save the link now. It is returned only once; if lost, create another
          and revoke the old invitation.
        </Text>
      </Card>
      {latest ? (
        <Card>
          <Text style={text.subheading}>Your new invitation</Text>
          <Text selectable style={text.mono}>
            {latest.url}
          </Text>
          <ActionButton
            label="Share invitation link"
            onPress={() => void share(latest.url)}
          />
          <ActionButton
            tone="secondary"
            label="Share installed-app link"
            onPress={() => void share(latest.nativeUrl)}
          />
          <Text style={text.caption}>
            The Web link works in a browser. The app link requires an installed
            ChainPass development or production build.
          </Text>
          {shareError ? <Feedback message={shareError} /> : null}
          <ActionButton
            tone="secondary"
            label="Dismiss link"
            onPress={() => setLatest(null)}
          />
        </Card>
      ) : null}
      <ActionButton
        tone="secondary"
        label="Refresh invitations"
        onPress={() => void links.refetch()}
      />
      {links.isPending ? (
        <Text style={text.body}>Loading invitations…</Text>
      ) : links.isError ? (
        <Feedback message={errorMessage(links.error)} />
      ) : !links.data?.length ? (
        <Card>
          <Text style={text.body}>
            No invitations yet. Published invitation-only events need a link for
            attendees to claim.
          </Text>
        </Card>
      ) : (
        links.data.map((invitation) => {
          const status = invitation.revokedAt
            ? "REVOKED"
            : Date.parse(invitation.expiresAt) <= now
              ? "EXPIRED"
              : invitation.usedCount >= invitation.maxUses
                ? "EXHAUSTED"
                : "ACTIVE";
          return (
            <Card key={invitation.id}>
              <Text style={text.subheading}>{invitation.ticketTypeName}</Text>
              <StatusPill
                label={status}
                tone={
                  status === "ACTIVE"
                    ? "success"
                    : status === "REVOKED"
                      ? "danger"
                      : "warning"
                }
              />
              <Fact
                label="Successful claims"
                value={`${invitation.usedCount} / ${invitation.maxUses}`}
              />
              <Fact
                label="Expires"
                value={formatEventDate(invitation.expiresAt)}
              />
              {!invitation.revokedAt ? (
                <ActionButton
                  tone="danger"
                  label="Revoke invitation"
                  onPress={() => {
                    revoke.reset();
                    setTarget(invitation);
                  }}
                />
              ) : null}
            </Card>
          );
        })
      )}
      <Sheet
        visible={Boolean(target)}
        title="Revoke this invitation?"
        onClose={() => {
          if (!revoke.isPending) setTarget(null);
        }}
      >
        <Text style={text.body}>
          This stops future claims through this link. Passes already issued
          remain valid.
        </Text>
        {revoke.isError ? (
          <Feedback message={errorMessage(revoke.error)} />
        ) : null}
        <ActionButton
          tone="danger"
          label="Confirm revoke"
          loading={revoke.isPending}
          onPress={() => {
            if (target) revoke.mutate(target.id);
          }}
        />
      </Sheet>
    </View>
  );
}
