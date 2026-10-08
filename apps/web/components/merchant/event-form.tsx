"use client";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createEventInputSchema,
  type CreateEventInput,
} from "@chainpass/schemas";
import { apiClient } from "@/lib/api-client";
import { optionalText, localDateToIso, errorMessage } from "@/lib/presentation";
import { PageHeading, ErrorState } from "@/components/chainpass/page-kit";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function EventForm() {
  const router = useRouter();
  const cache = useQueryClient();
  const form = useForm<CreateEventInput>({
    resolver: zodResolver(createEventInputSchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      startsAt: "",
      endsAt: "",
      accessMode: "INVITE_ONLY",
    },
  });
  const mutation = useMutation({
    mutationFn: apiClient.createEvent,
    onSuccess: (event) => {
      void cache.invalidateQueries({ queryKey: ["merchant-events"] });
      void cache.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Event created as a draft");
      router.push("/merchant/events/" + event.id);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;
  return (
    <>
      <PageHeading
        eyebrow="Merchant / create"
        title="Set the stage."
        description="Start with the essentials. Choose invitation-only access or public discovery before publishing."
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>
            After creation, add at least one active ticket type to publish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((input) => mutation.mutate(input))}
            noValidate
          >
            <FieldGroup>
              <Controller
                control={form.control}
                name="accessMode"
                render={({ field }) => (
                  <FieldSet>
                    <FieldLegend>Access</FieldLegend>
                    <FieldDescription>
                      Invitation-only events stay out of Discover, even after
                      publishing. Public events are discoverable and allow
                      direct claims. Access cannot be changed after creation in
                      this release.
                    </FieldDescription>
                    <RadioGroup
                      value={field.value ?? "INVITE_ONLY"}
                      onValueChange={field.onChange}
                    >
                      <Field orientation="horizontal">
                        <RadioGroupItem
                          id="access-invite"
                          value="INVITE_ONLY"
                        />
                        <FieldLabel htmlFor="access-invite">
                          Invitation only (recommended)
                        </FieldLabel>
                      </Field>
                      <Field orientation="horizontal">
                        <RadioGroupItem id="access-public" value="PUBLIC" />
                        <FieldLabel htmlFor="access-public">
                          Public discovery
                        </FieldLabel>
                      </Field>
                    </RadioGroup>
                  </FieldSet>
                )}
              />
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="event-name">Event name *</FieldLabel>
                <Input
                  id="event-name"
                  placeholder="Name your experience"
                  aria-invalid={Boolean(errors.name)}
                  {...register("name")}
                />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="event-description">Description</FieldLabel>
                <Textarea
                  id="event-description"
                  className="min-h-32"
                  aria-invalid={Boolean(errors.description)}
                  {...register("description", { setValueAs: optionalText })}
                />
                <FieldError errors={[errors.description]} />
              </Field>
              <Field data-invalid={Boolean(errors.location)}>
                <FieldLabel htmlFor="event-location">Location</FieldLabel>
                <Input
                  id="event-location"
                  aria-invalid={Boolean(errors.location)}
                  {...register("location", { setValueAs: optionalText })}
                />
                <FieldError errors={[errors.location]} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                {(
                  [
                    { name: "startsAt", label: "Starts at" },
                    { name: "endsAt", label: "Ends at" },
                  ] as const
                ).map(({ name, label }) => (
                  <Field key={name} data-invalid={Boolean(errors[name])}>
                    <FieldLabel htmlFor={name}>{label} *</FieldLabel>
                    <Input
                      id={name}
                      type="datetime-local"
                      aria-invalid={Boolean(errors[name])}
                      {...register(name, { setValueAs: localDateToIso })}
                    />
                    <FieldError errors={[errors[name]]} />
                  </Field>
                ))}
              </div>
              <FieldDescription>
                Times use your local timezone and are stored as ISO timestamps.
              </FieldDescription>
              <Field data-invalid={Boolean(errors.coverImageUrl)}>
                <FieldLabel htmlFor="event-cover">Cover image URL</FieldLabel>
                <Input
                  id="event-cover"
                  type="url"
                  placeholder="https://…"
                  aria-invalid={Boolean(errors.coverImageUrl)}
                  {...register("coverImageUrl", { setValueAs: optionalText })}
                />
                <FieldError errors={[errors.coverImageUrl]} />
              </Field>
              {mutation.isError && (
                <ErrorState error={mutation.error} title="Event not created" />
              )}
              <Button
                className="h-11"
                type="submit"
                disabled={mutation.isPending}
              >
                {mutation.isPending && <Spinner data-icon="inline-start" />}
                {mutation.isPending ? "Creating event…" : "Create draft event"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
