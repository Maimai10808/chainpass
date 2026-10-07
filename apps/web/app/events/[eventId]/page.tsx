import { EventDetail } from "./event-detail";
import type { Metadata } from "next";
import { createApiClient } from "@chainpass/api-client";

export async function generateMetadata({
  params,
}: PageProps<"/events/[eventId]">): Promise<Metadata> {
  const { eventId } = await params;
  try {
    const api = createApiClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL!,
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.timeout(4_000),
          cache: "no-store",
        }),
    });
    const event = await api.getPublishedEvent(eventId);
    return {
      title: event.name,
      description:
        event.description?.slice(0, 160) ??
        `Explore ${event.name} and claim your digital pass on ChainPass.`,
    };
  } catch {
    return {
      title: "Event",
      description: "Explore published events and claim your ChainPass.",
    };
  }
}

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[eventId]">) {
  const { eventId } = await params;

  return <EventDetail eventId={eventId} />;
}
