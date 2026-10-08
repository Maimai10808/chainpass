import { useState } from "react";
import { Text } from "react-native";
import { router, type Href } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEventInputSchema } from "@chainpass/schemas";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { keys } from "@/lib/product";
import { errorMessage } from "@/lib/errors";
import { triggerHaptic } from "@/design";
import {
  Screen,
  Heading,
  Card,
  Field,
  Feedback,
  ActionButton,
  FilterBar,
  text,
} from "@/components/chainpass/ui";
import { DateField } from "@/components/chainpass/date-field";
export default function CreateEvent() {
  const { data: session } = useSession();
  const client = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    coverImageUrl: "",
  });
  const [startsAt, setStart] = useState(() => new Date(Date.now() + 86400000));
  const [endsAt, setEnd] = useState(() => new Date(Date.now() + 90000000));
  const [validation, setValidation] = useState("");
  const [accessMode, setAccessMode] = useState<"INVITE_ONLY" | "PUBLIC">(
    "INVITE_ONLY",
  );
  const create = useMutation({
    mutationFn: apiClient.createEvent,
    onSuccess: (event) => {
      void client.invalidateQueries({
        queryKey: keys.merchantEvents(session!.user.id),
      });
      void client.invalidateQueries({
        queryKey: keys.adminEvents(session!.user.id),
      });
      void triggerHaptic("success");
      router.replace({
        pathname: "/merchant/events/[eventId]",
        params: { eventId: event.id },
      } as Href);
    },
  });
  function submit() {
    const result = createEventInputSchema.safeParse({
      name: form.name.trim(),
      accessMode,
      ...(form.description.trim()
        ? { description: form.description.trim() }
        : {}),
      ...(form.location.trim() ? { location: form.location.trim() } : {}),
      ...(form.coverImageUrl.trim()
        ? { coverImageUrl: form.coverImageUrl.trim() }
        : {}),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
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
  return (
    <Screen keyboard>
      <Heading
        eyebrow="MERCHANT"
        title="Create an experience."
        description="Start with a draft. Add tickets and publish when everything is ready."
      />
      <Card>
        <Text style={text.label}>Who can discover and claim?</Text>
        <FilterBar
          values={["Invitation only", "Public"]}
          value={accessMode === "INVITE_ONLY" ? "Invitation only" : "Public"}
          onChange={(value) =>
            setAccessMode(value === "Public" ? "PUBLIC" : "INVITE_ONLY")
          }
        />
        <Text style={text.body}>
          {accessMode === "INVITE_ONLY"
            ? "Not listed in Discover. After publishing, create and share an invitation for a specific ticket type."
            : "Published events appear in Discover and can be viewed by everyone."}
        </Text>
        {(["name", "description", "location", "coverImageUrl"] as const).map(
          (field) => (
            <Field
              key={field}
              label={
                {
                  name: "Event name",
                  description: "Description",
                  location: "Location",
                  coverImageUrl: "Cover image URL",
                }[field]
              }
              multiline={field === "description"}
              autoCapitalize={field === "coverImageUrl" ? "none" : "sentences"}
              keyboardType={field === "coverImageUrl" ? "url" : "default"}
              value={form[field]}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, [field]: value }))
              }
            />
          ),
        )}
        <DateField label="Starts" value={startsAt} onChange={setStart} />
        <DateField label="Ends" value={endsAt} onChange={setEnd} />
        <Text style={text.caption}>
          Dates use your device’s local timezone and are saved as UTC.
        </Text>
        {Boolean(validation) && <Feedback message={validation} />}
        {create.isError && <Feedback message={errorMessage(create.error)} />}
        <ActionButton
          label="Create draft"
          loading={create.isPending}
          onPress={submit}
        />
      </Card>
    </Screen>
  );
}
