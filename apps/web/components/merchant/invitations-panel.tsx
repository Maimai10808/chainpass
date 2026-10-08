"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2 } from "lucide-react";
import {
  createInvitationInputSchema,
  type CreateInvitationInput,
  type InvitationView,
  type TicketTypeResponse,
} from "@chainpass/schemas";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { formatDate, errorMessage, localDateToIso } from "@/lib/presentation";
import { invitationLink } from "@/lib/invitation-link";
import { useCurrentTime } from "@/lib/use-current-time";
import {
  LoadingCards,
  EmptyState,
  ErrorState,
} from "@/components/chainpass/page-kit";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function InvitationsPanel({
  eventId,
  tickets,
}: {
  eventId: string;
  tickets: TicketTypeResponse[];
}) {
  const { data: session } = useSession();
  const cache = useQueryClient();
  const now = useCurrentTime();
  const [latest, setLatest] = useState<{ id: string; url: string } | null>(
    null,
  );
  const [revokeTarget, setRevokeTarget] = useState<InvitationView | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const key = ["invitations", session?.user.id, eventId];
  const links = useQuery({
    queryKey: key,
    queryFn: () => apiClient.listInvitations(eventId),
    enabled: Boolean(session),
    refetchInterval: 30_000,
  });
  const form = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationInputSchema),
    defaultValues: { ticketTypeId: "", maxUses: 10, expiresAt: "" },
  });
  const create = useMutation({
    mutationFn: (input: CreateInvitationInput) =>
      apiClient.createInvitation(eventId, input),
    gcTime: 0,
    onSuccess: ({ invitation, token }) => {
      setLatest({
        id: invitation.id,
        url: invitationLink(window.location.origin, token),
      });
      void cache.invalidateQueries({ queryKey: key });
      toast.success("Invitation created. Save the link now.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const revoke = useMutation({
    mutationFn: apiClient.revokeInvitation,
    onSuccess: (result) => {
      if (latest?.id === result.id) setLatest(null);
      setRevokeTarget(null);
      void cache.invalidateQueries({ queryKey: key });
      toast.success("Invitation revoked. Issued passes remain valid.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  async function copy() {
    if (!latest) return;
    try {
      await navigator.clipboard.writeText(latest.url);
      toast.success("Invitation link copied");
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      toast("Link selected. Copy it manually using your browser.");
    }
  }
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;
  const active = tickets.filter((ticket) => ticket.status === "ACTIVE");
  return (
    <section
      className="flex flex-col gap-5"
      aria-labelledby="invitation-heading"
    >
      <h2 id="invitation-heading" className="text-h3 font-semibold">
        Invitations
      </h2>
      <Card>
        <CardHeader>
          <CardTitle>Create a shareable link</CardTitle>
          <CardDescription>
            Anyone with a valid link can sign in and claim its designated
            ticket. Links share ticket inventory; claim limits do not reserve
            stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((input) => create.mutate(input))}
            noValidate
          >
            <FieldGroup>
              <Field data-invalid={Boolean(errors.ticketTypeId)}>
                <FieldLabel htmlFor="invitation-ticket">Ticket type</FieldLabel>
                <NativeSelect
                  id="invitation-ticket"
                  aria-invalid={Boolean(errors.ticketTypeId)}
                  {...register("ticketTypeId")}
                >
                  <NativeSelectOption value="">
                    Choose an active ticket type
                  </NativeSelectOption>
                  {active.map((ticket) => (
                    <NativeSelectOption key={ticket.id} value={ticket.id}>
                      {ticket.name} · {ticket.totalSupply - ticket.claimedCount}{" "}
                      remaining
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError errors={[errors.ticketTypeId]} />
              </Field>
              <Field data-invalid={Boolean(errors.maxUses)}>
                <FieldLabel htmlFor="invitation-limit">
                  Maximum successful claims
                </FieldLabel>
                <Input
                  id="invitation-limit"
                  type="number"
                  min={1}
                  max={2147483647}
                  step={1}
                  aria-invalid={Boolean(errors.maxUses)}
                  {...register("maxUses", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.maxUses]} />
              </Field>
              <Field data-invalid={Boolean(errors.expiresAt)}>
                <FieldLabel htmlFor="invitation-expiry">Expires at</FieldLabel>
                <Input
                  id="invitation-expiry"
                  type="datetime-local"
                  aria-invalid={Boolean(errors.expiresAt)}
                  {...register("expiresAt", { setValueAs: localDateToIso })}
                />
                <FieldDescription>
                  Use your local timezone. Expiry must be in the future.
                </FieldDescription>
                <FieldError errors={[errors.expiresAt]} />
              </Field>
              {create.isError && (
                <ErrorState
                  title="Invitation not created"
                  error={create.error}
                />
              )}
              <Button
                type="submit"
                disabled={create.isPending || !active.length}
              >
                {create.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Link2 data-icon="inline-start" />
                )}
                Create invitation
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-caption text-muted-foreground">
            Full links are shown only when created. If you lose one, create a
            new invitation and revoke the old one.
          </p>
        </CardFooter>
      </Card>
      {latest && (
        <Card>
          <CardHeader>
            <CardTitle>Save your invitation link</CardTitle>
            <CardDescription>
              This credential can be forwarded. Share it only with people you
              want to invite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="created-invitation-link">
                Invitation link
              </FieldLabel>
              <Input
                ref={linkInput}
                id="created-invitation-link"
                readOnly
                value={latest.url}
                onFocus={(event) => event.currentTarget.select()}
              />
            </Field>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => void copy()}>
              <Copy data-icon="inline-start" />
              Copy link
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setLatest(null);
                create.reset();
              }}
            >
              Dismiss link
            </Button>
          </CardFooter>
        </Card>
      )}
      {links.isPending ? (
        <LoadingCards count={1} />
      ) : links.isError ? (
        <ErrorState error={links.error} retry={() => void links.refetch()} />
      ) : links.data.length === 0 ? (
        <EmptyState
          title="No invitations yet"
          description="Create a link to let attendees claim this event's passes."
        />
      ) : (
        links.data.map((link) => {
          const status = link.revokedAt
            ? "Revoked"
            : now !== 0 && new Date(link.expiresAt).getTime() <= now
              ? "Expired"
              : link.usedCount >= link.maxUses
                ? "Exhausted"
                : "Available";
          return (
            <Card key={link.id} size="sm">
              <CardHeader>
                <CardTitle>{link.ticketTypeName}</CardTitle>
                <CardDescription>
                  {link.usedCount} / {link.maxUses} claimed · Expires{" "}
                  {formatDate(link.expiresAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={status === "Available" ? "secondary" : "outline"}
                >
                  {status}
                </Badge>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  disabled={Boolean(link.revokedAt) || revoke.isPending}
                  onClick={() => setRevokeTarget(link)}
                >
                  Revoke invitation
                </Button>
              </CardFooter>
            </Card>
          );
        })
      )}
      <Dialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this invitation?</DialogTitle>
            <DialogDescription>
              No new passes can be claimed with this link. Already issued passes
              will not be revoked. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {revoke.isError && <ErrorState error={revoke.error} />}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              disabled={revoke.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() => {
                if (revokeTarget) revoke.mutate(revokeTarget.id);
              }}
            >
              {revoke.isPending && <Spinner data-icon="inline-start" />}Revoke
              link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
