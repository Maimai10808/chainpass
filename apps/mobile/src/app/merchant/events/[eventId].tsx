import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTicketTypeInputSchema } from "@chainpass/schemas";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { keys } from "@/lib/product";
import { errorMessage } from "@/lib/errors";
import { formatEventDate, formatPrice } from "@/lib/format";
import { triggerHaptic, getStatusTone } from "@/design";
import {
  Screen,
  Heading,
  Card,
  Fact,
  Field,
  StatusPill,
  ActionButton,
  Feedback,
  Sheet,
  SkeletonList,
  ScreenState,
  text,
  layoutStyles,
} from "@/components/chainpass/ui";
export default function ManageEvent() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { data: session } = useSession();
  const uid = session!.user.id;
  const client = useQueryClient();
  const [sheet, setSheet] = useState<"ticket" | "publish" | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "0",
    supply: "100",
  });
  const [validation, setValidation] = useState("");
  const event = useQuery({
    queryKey: keys.managedEvent(uid, eventId),
    queryFn: () => apiClient.getManagedEvent(eventId),
  });
  const tickets = useQuery({
    queryKey: keys.tickets(uid, eventId),
    queryFn: () => apiClient.listTicketTypes(eventId),
  });
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: keys.tickets(uid, eventId) }),
      client.invalidateQueries({ queryKey: keys.managedEvent(uid, eventId) }),
      client.invalidateQueries({ queryKey: keys.merchantEvents(uid) }),
      client.invalidateQueries({ queryKey: keys.adminEvents(uid) }),
      client.invalidateQueries({ queryKey: keys.events }),
      client.invalidateQueries({ queryKey: keys.event(eventId) }),
    ]);
  }
  const create = useMutation({
    mutationFn: (input: Parameters<typeof apiClient.createTicketType>[1]) =>
      apiClient.createTicketType(eventId, input),
    onSuccess: () => {
      void refresh();
      setSheet(null);
      setForm({ name: "", description: "", price: "0", supply: "100" });
      void triggerHaptic("success");
    },
  });
  const publish = useMutation({
    mutationFn: () => apiClient.publishEvent(eventId),
    onSuccess: () => {
      void refresh();
      setSheet(null);
      void triggerHaptic("success");
    },
  });
  function submitTicket() {
    const result = createTicketTypeInputSchema.safeParse({
      name: form.name.trim(),
      ...(form.description.trim()
        ? { description: form.description.trim() }
        : {}),
      price: /^\d+$/.test(form.price) ? Number(form.price) : NaN,
      totalSupply: /^\d+$/.test(form.supply) ? Number(form.supply) : NaN,
    });
    if (!result.success) {
      setValidation(
        result.error.issues.map((issue) => issue.message).join("\n"),
      );
      return;
    }
    setValidation("");
    create.mutate(result.data);
  }
  if (event.isPending) return <SkeletonList />;
  if (event.isError)
    return (
      <ScreenState
        title="Event unavailable"
        description={errorMessage(event.error)}
        action={
          <ActionButton label="Retry" onPress={() => void event.refetch()} />
        }
      />
    );
  const data = event.data;
  const canPublish = tickets.data?.some((ticket) => ticket.status === "ACTIVE");
  return (
    <Screen>
      <Heading
        eyebrow="EVENT OPERATIONS"
        title={data.name}
        description={data.description ?? undefined}
      />
      <Card>
        <StatusPill label={data.status} tone={getStatusTone(data.status)} />
        <Fact label="Starts" value={formatEventDate(data.startsAt)} />
        <Fact label="Ends" value={formatEventDate(data.endsAt)} />
        <Fact label="Location" value={data.location ?? "To be announced"} />
      </Card>
      <View style={layoutStyles.spread}>
        <Text style={text.heading}>Ticket types</Text>
        <ActionButton
          label="Add ticket"
          tone="secondary"
          onPress={() => {
            create.reset();
            setValidation("");
            setSheet("ticket");
          }}
        />
      </View>
      {tickets.isPending ? (
        <Text style={text.body}>Loading ticket types…</Text>
      ) : tickets.isError ? (
        <>
          <Feedback message={errorMessage(tickets.error)} />
          <ActionButton
            label="Retry tickets"
            onPress={() => void tickets.refetch()}
          />
        </>
      ) : (
        tickets.data.map((ticket) => (
          <Card key={ticket.id}>
            <View style={layoutStyles.spread}>
              <Text style={text.subheading}>{ticket.name}</Text>
              <StatusPill
                label={ticket.status}
                tone={getStatusTone(ticket.status)}
              />
            </View>
            {Boolean(ticket.description) && (
              <Text style={text.body}>{ticket.description}</Text>
            )}
            <Text style={text.body}>
              {formatPrice(ticket.price)} ·{" "}
              {ticket.totalSupply - ticket.claimedCount} / {ticket.totalSupply}{" "}
              available
            </Text>
          </Card>
        ))
      )}
      {tickets.data?.length === 0 && (
        <Card>
          <Text style={text.body}>
            Add a ticket type before publishing your event.
          </Text>
        </Card>
      )}
      {data.status === "DRAFT" ? (
        <Card>
          <Text style={text.subheading}>Ready to open the doors?</Text>
          <Text style={text.body}>
            Publishing makes this event visible to everyone. At least one active
            ticket type is required. Only free tickets can currently be claimed.
          </Text>
          <ActionButton
            disabled={!canPublish}
            label="Publish event"
            onPress={() => {
              publish.reset();
              setSheet("publish");
            }}
          />
        </Card>
      ) : (
        <Feedback
          tone="success"
          message="PUBLISHED — your event is visible in Discover."
        />
      )}
      <Sheet
        visible={sheet === "ticket"}
        title="Create ticket type"
        onClose={() => {
          if (!create.isPending) setSheet(null);
        }}
      >
        {(["name", "description", "price", "supply"] as const).map((field) => (
          <Field
            key={field}
            label={
              {
                name: "Ticket name",
                description: "Description",
                price: "Price (minor units, 0 = free)",
                supply: "Total supply",
              }[field]
            }
            keyboardType={
              field === "price" || field === "supply" ? "number-pad" : "default"
            }
            multiline={field === "description"}
            value={form[field]}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, [field]: value }))
            }
          />
        ))}
        <Text style={text.caption}>
          Only free tickets can currently be claimed. Payment is not supported.
        </Text>
        {Boolean(validation) && <Feedback message={validation} />}
        {create.isError && <Feedback message={errorMessage(create.error)} />}
        <ActionButton
          label="Create ticket"
          loading={create.isPending}
          onPress={submitTicket}
        />
      </Sheet>
      <Sheet
        visible={sheet === "publish"}
        title="Publish this event?"
        onClose={() => {
          if (!publish.isPending) setSheet(null);
        }}
      >
        <Text style={text.body}>
          People will be able to discover the event and claim available free
          tickets. Event editing and deletion are not currently supported.
        </Text>
        {publish.isError && <Feedback message={errorMessage(publish.error)} />}
        <ActionButton
          label="Confirm publish"
          loading={publish.isPending}
          onPress={() => publish.mutate()}
        />
      </Sheet>
    </Screen>
  );
}
