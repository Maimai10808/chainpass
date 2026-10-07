"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { eventsQuery } from "@/lib/queries";
import { EventCard } from "@/components/events/event-card";
import {
  PageHeading,
  LoadingCards,
  EmptyState,
  ErrorState,
} from "@/components/chainpass/page-kit";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";

export default function EventsPage() {
  const query = useQuery(eventsQuery);
  const [search, setSearch] = useState("");
  const events = query.data?.filter((event) =>
    (event.name + " " + (event.location ?? ""))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="Discover / experiences"
        title="Be there. Own the moment."
        description="Find your next gathering, claim a digital pass, and make your entrance."
      />
      <Field className="mb-8 max-w-md">
        <FieldLabel htmlFor="event-search" className="flex items-center gap-2">
          <Search className="size-4" />
          Find an experience
        </FieldLabel>
        <Input
          id="event-search"
          type="search"
          placeholder="Search events or locations"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      {query.isPending ? (
        <LoadingCards />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : events?.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            search ? "No matching experiences" : "The next chapter is coming"
          }
          description={
            search
              ? "Try a different name or location."
              : "Published events will appear here. Check back soon."
          }
        />
      )}
    </>
  );
}
