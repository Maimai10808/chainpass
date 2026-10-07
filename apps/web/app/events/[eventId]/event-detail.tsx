"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@chainpass/api-client";
import {
  CalendarDays,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { eventQuery } from "@/lib/queries";
import { errorMessage, formatDate, formatPrice } from "@/lib/presentation";
import { EventCover } from "@/components/events/event-card";
import {
  PageHeading,
  ErrorState,
  LoadingCards,
  StatusBadge,
  EmptyState,
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
import { Spinner } from "@/components/ui/spinner";

export function EventDetail({ eventId }: { eventId: string }) {
  const query = useQuery(eventQuery(eventId));
  const { data: session, isPending: sessionPending } = useSession();
  const router = useRouter();
  const cache = useQueryClient();
  const [terminal, setTerminal] = useState<Record<string, string>>({});
  const loginUrl = "/login?next=" + encodeURIComponent("/events/" + eventId);
  const claim = useMutation({
    mutationFn: (id: string) => apiClient.claimPass(id),
    onSuccess: (result) => {
      void cache.invalidateQueries({ queryKey: ["event", eventId] });
      void cache.invalidateQueries({
        queryKey: ["my-passes", session?.user.id],
      });
      toast.success("Pass claimed. You're on the list.");
      router.push("/my-passes/" + result.pass.id);
    },
    onError: (error, id) => {
      if (
        error instanceof ApiClientError &&
        ["PASS_ALREADY_CLAIMED", "TICKET_TYPE_SOLD_OUT"].includes(error.code)
      )
        setTerminal((state) => ({
          ...state,
          [id]:
            error.code === "PASS_ALREADY_CLAIMED"
              ? "Already claimed"
              : "Sold out",
        }));
      if (error instanceof ApiClientError && error.status === 401)
        router.push(loginUrl);
      toast.error(errorMessage(error));
      void cache.invalidateQueries({ queryKey: ["event", eventId] });
    },
  });
  if (query.isPending) return <LoadingCards count={2} />;
  if (query.isError)
    return (
      <ErrorState
        title="Event unavailable"
        error={query.error}
        retry={() => void query.refetch()}
      />
    );
  const event = query.data;
  return (
    <>
      <Button
        className="mb-6"
        variant="ghost"
        nativeButton={false}
        render={<Link href="/events" />}
      >
        <ArrowLeft data-icon="inline-start" />
        All experiences
      </Button>
      <EventCover large url={event.coverImageUrl} name={event.name} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <article>
          <StatusBadge status={event.status} />
          <div className="mt-4">
            <PageHeading
              title={event.name}
              description={"Hosted by " + event.organizer.name}
            />
          </div>
          <div className="mb-8 flex flex-col gap-4 text-muted-foreground">
            <p className="flex items-center gap-3">
              <CalendarDays className="size-5 text-primary" />
              {formatDate(event.startsAt)} — {formatDate(event.endsAt)}
            </p>
            <p className="flex items-center gap-3">
              <MapPin className="size-5 text-primary" />
              {event.location ?? "Location to be announced"}
            </p>
          </div>
          <h2 className="mb-3 text-h3 font-semibold">About this experience</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {event.description ??
              "The organizer hasn't added a description yet."}
          </p>
        </article>
        <section aria-labelledby="ticket-heading">
          <h2
            id="ticket-heading"
            className="mb-5 flex items-center gap-2 text-h3 font-semibold"
          >
            <Ticket className="size-5 text-primary" />
            Choose your pass
          </h2>
          <div className="flex flex-col gap-4">
            {event.ticketTypes.map((ticket) => (
              <Card key={ticket.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{ticket.name}</CardTitle>
                    <span className="text-lg font-semibold text-primary">
                      {formatPrice(ticket.price)}
                    </span>
                  </div>
                  <CardDescription>
                    {ticket.description ?? "Admission to this experience."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-body-sm text-muted-foreground">
                    {ticket.remaining} / {ticket.totalSupply} remaining
                  </p>
                  {ticket.price !== "0" && (
                    <p className="mt-2 text-caption text-muted-foreground">
                      Price is listed for reference. Payment is not supported in
                      this testnet release.
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="h-11 w-full"
                    disabled={
                      sessionPending ||
                      claim.isPending ||
                      ticket.remaining === 0 ||
                      Boolean(terminal[ticket.id]) ||
                      session?.user.role === "merchant"
                    }
                    onClick={() =>
                      session ? claim.mutate(ticket.id) : router.push(loginUrl)
                    }
                  >
                    {claim.isPending && claim.variables === ticket.id ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <ArrowRight data-icon="inline-end" />
                    )}
                    {terminal[ticket.id] ??
                      (ticket.remaining === 0
                        ? "Sold out"
                        : session?.user.role === "merchant"
                          ? "Attendee account required"
                          : claim.isPending && claim.variables === ticket.id
                            ? "Claiming…"
                            : session
                              ? "Claim pass"
                              : "Sign in to claim")}
                  </Button>
                  {terminal[ticket.id] === "Already claimed" && (
                    <Button
                      variant="link"
                      render={<Link href="/my-passes" />}
                      nativeButton={false}
                    >
                      My passes
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
            {event.ticketTypes.length === 0 && (
              <EmptyState
                title="No available passes"
                description="The organizer has no active ticket types available."
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
