import { Redirect } from "expo-router";
import { WorkspaceTabs } from "@/components/chainpass/workspace-tabs";
import { useSession } from "@/lib/auth-client";
import { getRole } from "@/lib/product";
export default function MerchantTabs() {
  const { data } = useSession();
  return getRole(data?.user) === "admin" ? (
    <Redirect href="/admin" />
  ) : (
    <WorkspaceTabs workspace="merchant" />
  );
}
