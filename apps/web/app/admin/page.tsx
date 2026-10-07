"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, CalendarDays } from "lucide-react";
import { adminEventsQuery } from "@/lib/queries";
import { listUsers } from "@/lib/admin-api";
import { MetricCards, EventTable } from "@/components/merchant/event-list";
import {
  PageHeading,
  LoadingCards,
  ErrorState,
  EmptyState,
} from "@/components/chainpass/page-kit";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const events = useQuery(adminEventsQuery);
  const users = useQuery({
    queryKey: ["admin-user-counts"],
    queryFn: async () => {
      const [all, merchants] = await Promise.all([
        listUsers({ limit: 1 }),
        listUsers({ role: "merchant", limit: 1 }),
      ]);
      return { total: all.total, merchants: merchants.total };
    },
  });
  if (events.isPending || users.isPending) return <LoadingCards count={4} />;
  if (events.isError || users.isError)
    return (
      <ErrorState
        error={events.error ?? users.error}
        retry={() => {
          void events.refetch();
          void users.refetch();
        }}
      />
    );
  return (
    <>
      <PageHeading
        eyebrow="Admin / platform"
        title="Keep the platform moving."
        description="Manage identities and organizers. Review the experiences on ChainPass."
      />
      <MetricCards
        items={[
          { label: "Total users", value: users.data.total },
          { label: "Merchants", value: users.data.merchants },
          { label: "Events", value: events.data.length },
          {
            label: "Published events",
            value: events.data.filter((event) => event.status === "PUBLISHED")
              .length,
          },
        ]}
      />
      <div className="mb-10 flex flex-wrap gap-3">
        <Button
          className="h-10"
          nativeButton={false}
          render={<Link href="/admin/users" />}
        >
          <Users data-icon="inline-start" />
          Manage users
        </Button>
        <Button
          variant="outline"
          className="h-10"
          nativeButton={false}
          render={<Link href="/admin/events" />}
        >
          <CalendarDays data-icon="inline-start" />
          Platform events
        </Button>
      </div>
      <h2 className="mb-5 text-h3 font-semibold">Recent platform events</h2>
      {events.data.length ? (
        <EventTable events={events.data.slice(0, 5)} platform />
      ) : (
        <EmptyState
          title="No platform events yet"
          description="Promote an organizer, or create the first event from the merchant workspace."
          href="/merchant/events/new"
          action="Create event"
        />
      )}
    </>
  );
}
