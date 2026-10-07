import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers, promoteMerchant } from "@/lib/admin-api";
import { useSession } from "@/lib/auth-client";
import { keys } from "@/lib/product";
import { triggerHaptic } from "@/design";
import {
  Heading,
  Card,
  Field,
  FilterBar,
  StatusPill,
  ActionButton,
  Feedback,
  Sheet,
  ScreenState,
  text,
  layoutStyles,
} from "@/components/chainpass/ui";
const PAGE_SIZE = 20;
type AdminUser = Awaited<ReturnType<typeof listUsers>>["users"][number];
export default function Users() {
  const { data: session } = useSession();
  const uid = session!.user.id;
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("All");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const users = useQuery({
    queryKey: [...keys.users(uid), debounced, role, offset],
    queryFn: () =>
      listUsers({
        search: debounced,
        role: role === "All" ? "" : role.toLowerCase(),
        offset,
        limit: PAGE_SIZE,
      }),
  });
  const promote = useMutation({
    mutationFn: (user: AdminUser) => {
      if (user.id === uid || user.role !== "user" || user.banned)
        throw new Error("Action not allowed");
      return promoteMerchant(user.id);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.users(uid) });
      setSelected(null);
      void triggerHaptic("success");
    },
    onError: () => {
      void triggerHaptic("error");
    },
  });
  return (
    <>
      <FlatList
        style={layoutStyles.screen}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={layoutStyles.listContent}
        data={users.data?.users ?? []}
        keyExtractor={(user) => user.id}
        refreshing={users.isRefetching}
        onRefresh={() => void users.refetch()}
        ListHeaderComponent={
          <View style={layoutStyles.section}>
            <Heading
              eyebrow="ADMIN"
              title="People & organizers."
              description="Promote a user to merchant when they’re ready to host."
            />
            <Field
              label="Search by email"
              autoCapitalize="none"
              value={search}
              onChangeText={setSearch}
            />
            <FilterBar
              values={["All", "User", "Merchant", "Admin"]}
              value={role}
              onChange={(value) => {
                setRole(value);
                setOffset(0);
              }}
            />
            {users.isError && (
              <>
                <Feedback message="User list unavailable. Check your connection and admin session." />
                <ActionButton
                  label="Retry"
                  onPress={() => void users.refetch()}
                />
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          users.isPending ? (
            <Card>
              <ActivityIndicator accessibilityLabel="Loading users" />
            </Card>
          ) : !users.isError ? (
            <ScreenState
              title="No users found"
              description="Try another search or role filter."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={text.subheading}>{item.name}</Text>
            <Text style={text.body}>{item.email}</Text>
            <View style={layoutStyles.row}>
              <StatusPill
                label={item.role ?? "user"}
                tone={
                  item.role === "admin"
                    ? "violet"
                    : item.role === "merchant"
                      ? "info"
                      : "neutral"
                }
              />
              <StatusPill
                label={item.banned ? "BANNED" : "ACTIVE"}
                tone={item.banned ? "danger" : "success"}
              />
            </View>
            {item.role === "user" && item.id !== uid && !item.banned && (
              <ActionButton
                tone="secondary"
                label="Promote to merchant"
                onPress={() => {
                  promote.reset();
                  setSelected(item);
                }}
              />
            )}
          </Card>
        )}
        ListFooterComponent={
          users.data ? (
            <View style={layoutStyles.section}>
              <Text style={text.caption}>
                {users.data.total
                  ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, users.data.total)} of ${users.data.total}`
                  : "0 users"}
              </Text>
              <View style={layoutStyles.row}>
                <ActionButton
                  label="Previous"
                  tone="secondary"
                  disabled={offset === 0 || users.isFetching}
                  onPress={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                />
                <ActionButton
                  label="Next"
                  tone="secondary"
                  disabled={
                    offset + PAGE_SIZE >= users.data.total || users.isFetching
                  }
                  onPress={() => setOffset(offset + PAGE_SIZE)}
                />
              </View>
            </View>
          ) : null
        }
      />
      <Sheet
        visible={Boolean(selected)}
        title="Promote to merchant?"
        onClose={() => {
          if (!promote.isPending) setSelected(null);
        }}
      >
        <Text style={text.body}>
          {selected?.name} will be able to create and publish events and check
          in passes for their own events.
        </Text>
        <Text style={text.label}>{selected?.email}</Text>
        {promote.isError && (
          <Feedback message="Promotion failed. Refresh the list and try again." />
        )}
        <ActionButton
          label="Confirm promotion"
          loading={promote.isPending}
          onPress={() => {
            if (selected) promote.mutate(selected);
          }}
        />
      </Sheet>
    </>
  );
}
