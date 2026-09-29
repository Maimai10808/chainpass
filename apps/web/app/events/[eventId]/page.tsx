import { EventDetail } from "./event-detail";

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[eventId]">) {
  const { eventId } = await params;

  return <EventDetail eventId={eventId} />;
}
