import type { Metadata } from "next";
import { InvitationEntry } from "./invitation-entry";

// This bearer-link entry must not be served from a shared page cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your invitation",
  description: "Open your organizer's invitation to claim a ChainPass.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InvitationPage() {
  return <InvitationEntry />;
}
