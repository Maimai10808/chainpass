"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, ScanLine, CalendarDays } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { merchantEventsQuery } from "@/lib/queries";
import {
  PageHeading,
  LoadingCards,
  ErrorState,
  EmptyState,
} from "@/components/chainpass/page-kit";
import { MetricCards, EventTable } from "@/components/merchant/event-list";
import { Button } from "@/components/ui/button";

export default function MerchantDashboard() {
  const { data: session } = useSession();
  const query = useQuery(merchantEventsQuery(session?.user.id));
  if (query.isPending) return <LoadingCards count={4} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const events = query.data;
  return (
    <>
      <PageHeading
        eyebrow="Merchant / overview"
        title={"Welcome, " + (session?.user.name ?? "organizer") + "."}
        description="Bring people together. Everything you need to issue passes and run the gate."
      />
      <MetricCards
        items={[
          { label: "My events", value: events.length },
          {
            label: "Published",
            value: events.filter((event) => event.status === "PUBLISHED")
              .length,
          },
          {
            label: "Drafts",
            value: events.filter((event) => event.status === "DRAFT").length,
          },
          {
            label: "Ticket types",
            value: events.reduce(
              (sum, event) => sum + event.ticketTypeCount,
              0,
            ),
          },
        ]}
      />
      <div className="mb-10 flex flex-wrap gap-3">
        <Button
          className="h-10"
          nativeButton={false}
          render={<Link href="/merchant/events/new" />}
        >
          <Plus data-icon="inline-start" />
          Create event
        </Button>
        <Button
          variant="outline"
          className="h-10"
          nativeButton={false}
          render={<Link href="/merchant/events" />}
        >
          <CalendarDays data-icon="inline-start" />
          Manage events
        </Button>
        <Button
          variant="outline"
          className="h-10"
          nativeButton={false}
          render={<Link href="/merchant/check-in" />}
        >
          <ScanLine data-icon="inline-start" />
          Open check-in
        </Button>
      </div>
      <h2 className="mb-5 text-h3 font-semibold">Recent events</h2>
      {events.length ? (
        <EventTable events={events.slice(0, 5)} />
      ) : (
        <EmptyState
          title="Your first experience starts here"
          description="Create a draft event and issue your first ticket type."
          href="/merchant/events/new"
          action="Create event"
        />
      )}
    </>
  );
}
