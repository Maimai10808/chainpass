import { WorkspaceShell } from "@/components/chainpass/workspace-shell";
export const metadata = { title: "Admin workspace", robots: { index: false } };
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell kind="admin">{children}</WorkspaceShell>;
}
