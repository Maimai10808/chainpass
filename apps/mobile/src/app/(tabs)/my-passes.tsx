import { useQuery } from "@tanstack/react-query";
import { FlatList } from "react-native";
import { router } from "expo-router";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { keys } from "@/lib/product";
import { errorMessage } from "@/lib/errors";
import { PassCard } from "@/components/chainpass/pass-card";
import {
  ActionButton,
  Heading,
  SkeletonList,
  ScreenState,
  layoutStyles,
} from "@/components/chainpass/ui";
import { useScreenActive } from "@/hooks/use-screen-active";
export default function MyPasses() {
  const { data: session } = useSession();
  const active = useScreenActive();
  const passes = useQuery({
    queryKey: keys.passes(session?.user.id ?? ""),
    queryFn: () => apiClient.getMyPasses(),
    enabled: Boolean(session) && active,
  });
  if (!session)
    return (
      <ScreenState
        title="Your passes, in your pocket."
        description="Sign in to collect and present your event passes."
        action={
          <ActionButton
            label="Sign in"
            onPress={() =>
              router.push({
                pathname: "/auth/sign-in",
                params: { returnTo: "/my-passes" },
              })
            }
          />
        }
      />
    );
  if (passes.isPending) return <SkeletonList />;
  if (passes.isError && !passes.data)
    return (
      <ScreenState
        title="Passes unavailable"
        description={errorMessage(passes.error)}
        action={
          <ActionButton label="Retry" onPress={() => void passes.refetch()} />
        }
      />
    );
  return (
    <FlatList
      style={layoutStyles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={layoutStyles.listContent}
      data={passes.data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PassCard pass={item} />}
      refreshing={passes.isRefetching}
      onRefresh={() => void passes.refetch()}
      ListHeaderComponent={
        <Heading
          title="Your collection."
          description="Every experience starts with a pass."
        />
      }
      ListEmptyComponent={
        <ScreenState
          title="No passes yet"
          description="Find an event and claim your first digital ticket."
          action={
            <ActionButton
              label="Discover events"
              onPress={() => router.push("/")}
            />
          }
        />
      }
    />
  );
}
