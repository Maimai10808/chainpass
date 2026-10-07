import { RouteGate } from "@/components/auth/route-gate";
export const metadata = { title: "My passes", robots: { index: false } };
export default function PassesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteGate>{children}</RouteGate>;
}
