import { EventManagement } from "./event-management";

export default async function MerchantEventPage({
  params,
}: PageProps<"/merchant/events/[eventId]">) {
  const { eventId } = await params;

  return <EventManagement eventId={eventId} />;
}
