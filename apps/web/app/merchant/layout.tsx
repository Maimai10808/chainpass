import { WorkspaceShell } from "@/components/chainpass/workspace-shell";
export const metadata = {
  title: "Merchant workspace",
  robots: { index: false },
};
export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell kind="merchant">{children}</WorkspaceShell>;
}
