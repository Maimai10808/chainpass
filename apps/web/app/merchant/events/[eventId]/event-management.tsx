"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createTicketTypeInputSchema,
  type CreateTicketTypeInput,
} from "@chainpass/schemas";
import { CheckCircle2, ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import {
  optionalText,
  formatPrice,
  formatDate,
  errorMessage,
} from "@/lib/presentation";
import {
  PageHeading,
  LoadingCards,
  ErrorState,
  EmptyState,
  StatusBadge,
  Detail,
} from "@/components/chainpass/page-kit";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function EventManagement({ eventId }: { eventId: string }) {
  const cache = useQueryClient();
  const [publishOpen, setPublishOpen] = useState(false);
  const event = useQuery({
    queryKey: ["managed-event", eventId],
    queryFn: () => apiClient.getManagedEvent(eventId),
  });
  const tickets = useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: () => apiClient.listTicketTypes(eventId),
    enabled: event.isSuccess,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTicketTypeInput>({
    resolver: zodResolver(createTicketTypeInputSchema),
    defaultValues: { name: "", totalSupply: 100, price: 0 },
  });
  function refresh() {
    void cache.invalidateQueries({ queryKey: ["managed-event", eventId] });
    void cache.invalidateQueries({ queryKey: ["ticket-types", eventId] });
    void cache.invalidateQueries({ queryKey: ["merchant-events"] });
    void cache.invalidateQueries({ queryKey: ["admin-events"] });
    void cache.invalidateQueries({ queryKey: ["events"] });
    void cache.invalidateQueries({ queryKey: ["event", eventId] });
  }
  const create = useMutation({
    mutationFn: (input: CreateTicketTypeInput) =>
      apiClient.createTicketType(eventId, input),
    onSuccess: () => {
      refresh();
      reset({ name: "", description: "", totalSupply: 100, price: 0 });
      toast.success("Ticket type created");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const publish = useMutation({
    mutationFn: () => apiClient.publishEvent(eventId),
    onSuccess: (result) => {
      cache.setQueryData(["managed-event", eventId], result);
      refresh();
      setPublishOpen(false);
      toast.success("Your event is live");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  if (event.isPending) return <LoadingCards count={2} />;
  if (event.isError)
    return (
      <ErrorState
        title="Event management unavailable"
        error={event.error}
        retry={() => void event.refetch()}
      />
    );
  const data = event.data;
  const canPublish =
    tickets.data?.some((ticket) => ticket.status === "ACTIVE") ?? false;
  return (
    <>
      <PageHeading
        eyebrow="Merchant / manage"
        title={data.name}
        description="Manage inventory and publish your experience."
        action={<StatusBadge status={data.status} />}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Event overview</CardTitle>
              <CardDescription>
                {data.description ?? "No description provided."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail label="Schedule">
                  <span className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                    {formatDate(data.startsAt)} — {formatDate(data.endsAt)}
                  </span>
                </Detail>
                <Detail label="Location">
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4 text-primary" />
                    {data.location ?? "Location TBA"}
                  </span>
                </Detail>
                <Detail label="Event ID" mono>
                  {data.id}
                </Detail>
                <Detail label="Organizer ID" mono>
                  {data.organizerId}
                </Detail>
              </dl>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-3">
              {data.status === "PUBLISHED" ? (
                <>
                  <p className="flex items-center gap-2 text-body-sm text-success">
                    <CheckCircle2 className="size-4" />
                    Published and discoverable
                  </p>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={"/events/" + data.id} />}
                  >
                    Public event
                    <ArrowUpRight data-icon="inline-end" />
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-body-sm text-muted-foreground">
                    {canPublish
                      ? "Ready to publish. Attendees will be able to claim active passes."
                      : "Create at least one active ticket type before publishing."}
                  </p>
                  <Button
                    disabled={!canPublish || publish.isPending}
                    onClick={() => setPublishOpen(true)}
                  >
                    Publish event
                  </Button>
                </>
              )}
              <p className="text-caption text-muted-foreground">
                Event editing and deletion are not available in this release.
              </p>
            </CardFooter>
          </Card>
          <section>
            <h2 className="mb-5 text-h3 font-semibold">Ticket inventory</h2>
            {tickets.isPending ? (
              <LoadingCards count={1} />
            ) : tickets.isError ? (
              <ErrorState
                error={tickets.error}
                retry={() => void tickets.refetch()}
              />
            ) : tickets.data.length ? (
              <div className="flex flex-col gap-4">
                {tickets.data.map((ticket) => (
                  <Card key={ticket.id}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle>{ticket.name}</CardTitle>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <CardDescription>
                        {ticket.description ?? "General admission"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Detail label="Supply" mono>
                          {ticket.totalSupply}
                        </Detail>
                        <Detail label="Claimed" mono>
                          {ticket.claimedCount}
                        </Detail>
                        <Detail label="Remaining" mono>
                          {ticket.totalSupply - ticket.claimedCount}
                        </Detail>
                        <Detail label="Price">
                          {formatPrice(ticket.price)}
                        </Detail>
                      </dl>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No ticket types yet"
                description="Add your first ticket type to make this event publishable."
              />
            )}
          </section>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Issue a ticket type</CardTitle>
            <CardDescription>
              New ticket types are ACTIVE. Price is an integer in minor currency
              units; use 0 for free. Payment is not supported.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((input) => create.mutate(input))}
              noValidate
            >
              <FieldGroup>
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="ticket-name">Name *</FieldLabel>
                  <Input
                    id="ticket-name"
                    aria-invalid={Boolean(errors.name)}
                    {...register("name")}
                  />
                  <FieldError errors={[errors.name]} />
                </Field>
                <Field data-invalid={Boolean(errors.description)}>
                  <FieldLabel htmlFor="ticket-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    id="ticket-description"
                    aria-invalid={Boolean(errors.description)}
                    {...register("description", { setValueAs: optionalText })}
                  />
                  <FieldError errors={[errors.description]} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  {(
                    [
                      { name: "totalSupply", label: "Total supply", min: 1 },
                      { name: "price", label: "Price (minor units)", min: 0 },
                    ] as const
                  ).map(({ name, label, min }) => (
                    <Field key={name} data-invalid={Boolean(errors[name])}>
                      <FieldLabel htmlFor={name}>{label} *</FieldLabel>
                      <Input
                        id={name}
                        min={min}
                        step={1}
                        type="number"
                        aria-invalid={Boolean(errors[name])}
                        {...register(name, { valueAsNumber: true })}
                      />
                      <FieldError errors={[errors[name]]} />
                    </Field>
                  ))}
                </div>
                {create.isError && (
                  <ErrorState
                    title="Ticket type not created"
                    error={create.error}
                  />
                )}
                <Button
                  type="submit"
                  className="h-11"
                  disabled={create.isPending}
                >
                  {create.isPending && <Spinner data-icon="inline-start" />}
                  {create.isPending ? "Creating…" : "Create ticket type"}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish this experience?</DialogTitle>
            <DialogDescription>
              It will become publicly visible, and attendees can claim active
              passes. There is no unpublish action in this release.
            </DialogDescription>
          </DialogHeader>
          {publish.isError && <ErrorState error={publish.error} />}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={publish.isPending}
              onClick={() => setPublishOpen(false)}
            >
              Keep as draft
            </Button>
            <Button
              disabled={publish.isPending}
              onClick={() => publish.mutate()}
            >
              {publish.isPending && <Spinner data-icon="inline-start" />}Publish
              event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
