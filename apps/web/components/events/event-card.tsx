"use client";

import Link from "next/link";
import type { PublicEventSummary } from "@chainpass/schemas";
import { ArrowUpRight, CalendarDays, MapPin, Ticket } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/chainpass/page-kit";
import { formatDate } from "@/lib/presentation";

export function EventCover({
  url,
  name,
  large = false,
}: {
  url: string | null;
  name: string;
  large?: boolean;
}) {
  return (
    <div
      className={
        large
          ? "relative aspect-[21/9] overflow-hidden rounded-xl bg-surface-2"
          : "relative aspect-[16/9] overflow-hidden rounded-lg bg-surface-2"
      }
    >
      {url ? (
        <div
          role="img"
          aria-label={name + " cover"}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(" + JSON.stringify(url) + ")" }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-indigo/15 via-surface-2 to-brand-cyan/10"
        >
          <Ticket className="size-16 text-primary/40" />
          <span className="absolute bottom-4 left-5 font-mono text-caption uppercase tracking-widest text-muted-foreground">
            Experience / ChainPass
          </span>
        </div>
      )}
    </div>
  );
}

export function EventCard({ event }: { event: PublicEventSummary }) {
  return (
    <Card className="h-full overflow-hidden transition-transform motion-safe:hover:-translate-y-1">
      <CardHeader>
        <EventCover url={event.coverImageUrl} name={event.name} />
        <div className="mt-3">
          <StatusBadge status={event.status} />
        </div>
        <CardTitle className="mt-1 line-clamp-2 text-xl">
          <Link href={"/events/" + event.id} className="hover:text-primary">
            {event.name}
          </Link>
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {event.description ?? "A new experience is waiting for you."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-body-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0" />
          {formatDate(event.startsAt)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0" />
          {event.location ?? "Location to be announced"}
        </p>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button
          className="w-full"
          variant="outline"
          nativeButton={false}
          render={<Link href={"/events/" + event.id} />}
        >
          View experience
          <ArrowUpRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}
