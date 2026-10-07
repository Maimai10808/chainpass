import { redirect } from "next/navigation";
// Retain old bookmarks without exposing a development console.
export default function LegacyAuthPage() {
  redirect("/login");
}
