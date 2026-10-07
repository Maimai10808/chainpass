"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight } from "lucide-react";
import type { ManagedEventSummary } from "@chainpass/api-client";
import { useSession } from "@/lib/auth-client";
import { merchantEventsQuery, adminEventsQuery } from "@/lib/queries";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/presentation";
import {
  PageHeading,
  LoadingCards,
  ErrorState,
  EmptyState,
  StatusBadge,
} from "@/components/chainpass/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function EventTable({
  events,
  platform = false,
}: {
  events: ManagedEventSummary[];
  platform?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            {platform && <TableHead>Organizer</TableHead>}
            <TableHead>Schedule</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ticket types</TableHead>
            <TableHead>
              <span className="sr-only">Manage</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <Link
                  href={"/merchant/events/" + event.id}
                  className="font-medium hover:text-primary"
                >
                  {event.name}
                </Link>
                <p className="mt-1 text-caption text-muted-foreground">
                  {event.location ?? "Location TBA"}
                </p>
              </TableCell>
              {platform && <TableCell>{event.organizer.name}</TableCell>}
              <TableCell className="text-body-sm">
                {formatDate(event.startsAt)}
              </TableCell>
              <TableCell>
                <StatusBadge status={event.status} />
              </TableCell>
              <TableCell className="font-mono">
                {event.ticketTypeCount}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  nativeButton={false}
                  render={
                    <Link
                      href={"/merchant/events/" + event.id}
                      aria-label={"Manage " + event.name}
                    />
                  }
                >
                  Manage
                  <ArrowUpRight data-icon="inline-end" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function EventList({ platform = false }: { platform?: boolean }) {
  const { data: session } = useSession();
  const query = useQuery({
    queryKey: platform
      ? adminEventsQuery.queryKey
      : merchantEventsQuery(session?.user.id).queryKey,
    queryFn: () =>
      platform ? apiClient.listAdminEvents() : apiClient.listMyEvents(),
    enabled: Boolean(session),
  });
  const [search, setSearch] = useState("");
  const rows = query.data?.filter((event) =>
    (event.name + " " + event.organizer.name)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow={platform ? "Admin / platform" : "Merchant / experiences"}
        title={platform ? "Platform events" : "Your events"}
        description={
          platform
            ? "Draft and published events across all organizers."
            : "Create, issue and publish. Only your events appear here."
        }
        action={
          <Button
            className="h-10"
            nativeButton={false}
            render={<Link href="/merchant/events/new" />}
          >
            <Plus data-icon="inline-start" />
            Create event
          </Button>
        }
      />
      <Field className="mb-6 max-w-sm">
        <FieldLabel htmlFor="managed-search">
          Search events{platform ? " or organizers" : ""}
        </FieldLabel>
        <Input
          id="managed-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      {query.isPending ? (
        <LoadingCards count={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : rows?.length ? (
        <EventTable events={rows} platform={platform} />
      ) : (
        <EmptyState
          title={search ? "No matching events" : "No events yet"}
          description={
            search
              ? "Try another search."
              : "Start with a draft, add a ticket type, then publish."
          }
          href={search ? undefined : "/merchant/events/new"}
          action="Create event"
        />
      )}
    </>
  );
}

export function MetricCards({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardTitle className="text-body-sm text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-h1">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
