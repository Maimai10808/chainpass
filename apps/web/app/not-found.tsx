import { EmptyState } from "@/components/chainpass/page-kit";
export default function NotFound() {
  return (
    <EmptyState
      title="This page is off the map"
      description="The page may have moved, or this link is no longer available."
      href="/events"
    />
  );
}
