import { Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { listUsers } from "@/lib/admin-api";
import { keys } from "@/lib/product";
import { useManagedEvents } from "@/components/chainpass/managed-events";
import {
  Screen,
  Heading,
  Card,
  Fact,
  ActionButton,
  SkeletonList,
  ScreenState,
  text,
  layoutStyles,
} from "@/components/chainpass/ui";
export default function AdminOverview() {
  const { data: session } = useSession();
  const uid = session!.user.id;
  const events = useManagedEvents(true);
  const metrics = useQuery({
    queryKey: [...keys.users(uid), "metrics"],
    queryFn: async () => {
      const [all, merchants] = await Promise.all([
        listUsers({ limit: 1 }),
        listUsers({ limit: 1, role: "merchant" }),
      ]);
      return { users: all.total, merchants: merchants.total };
    },
  });
  if (events.isPending || metrics.isPending) return <SkeletonList />;
  if (events.isError || metrics.isError)
    return (
      <ScreenState
        title="Overview unavailable"
        description="Check your connection and admin session."
        action={
          <ActionButton
            label="Retry"
            onPress={() => {
              void events.refetch();
              void metrics.refetch();
            }}
          />
        }
      />
    );
  return (
    <Screen>
      <Heading
        eyebrow="ADMIN"
        title="Keep things moving."
        description="A clear view of your platform. No noise."
      />
      <Card>
        <View style={layoutStyles.spread}>
          <Fact label="Users" value={String(metrics.data.users)} />
          <Fact label="Merchants" value={String(metrics.data.merchants)} />
          <Fact label="Events" value={String(events.data.length)} />
          <Fact
            label="Published"
            value={String(
              events.data.filter((event) => event.status === "PUBLISHED")
                .length,
            )}
          />
        </View>
      </Card>
      <ActionButton
        label="Manage users"
        onPress={() => router.push("/admin/users" as Href)}
      />
      <ActionButton
        label="View platform events"
        tone="secondary"
        onPress={() => router.push("/admin/events" as Href)}
      />
      <Card>
        <Text style={text.subheading}>Secure by default.</Text>
        <Text style={text.body}>
          Accounts are created as users. Promote organizers to merchant here;
          administrator privileges are not offered as a shortcut.
        </Text>
      </Card>
    </Screen>
  );
}
