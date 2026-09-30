import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  Card,
  ScreenState,
  StatusPill,
  layoutStyles,
} from "@/components/chainpass/ui";
import { useTheme } from "@/hooks/use-theme";
import { signOut, useSession } from "@/lib/auth-client";

export default function ProfileScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data: session, isPending } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      const result = await signOut();
      if (result.error) {
        setError(result.error.message ?? "Unable to sign out.");
        return;
      }
      queryClient.clear();
    } catch {
      setError("Network unavailable. Try signing out again.");
    } finally {
      setSigningOut(false);
    }
  }

  if (isPending) return <ScreenState loading title="Restoring your session…" />;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={layoutStyles.scrollContent}
      style={[
        layoutStyles.screen,
        { backgroundColor: theme.backgroundElement },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Your Better Auth identity is shared across ChainPass Web and Mobile.
        </Text>
      </View>
      {session ? (
        <Card>
          <StatusPill label={getRole(session.user).toUpperCase()} />
          <ProfileFact label="Name" value={session.user.name} />
          <ProfileFact label="Email" value={session.user.email} />
          <ProfileFact label="User ID" value={session.user.id} />
          {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
          <ActionButton
            label="Sign out"
            loading={signingOut}
            onPress={() => void handleSignOut()}
            tone="danger"
          />
        </Card>
      ) : (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Sign in to use your passes
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Browsing remains public. Claiming and My Passes use your securely
            stored session.
          </Text>
          <ActionButton
            label="Sign in"
            onPress={() => router.push("/auth/sign-in")}
          />
          <ActionButton
            label="Create account"
            onPress={() => router.push("/auth/sign-up")}
            tone="secondary"
          />
        </Card>
      )}
    </ScrollView>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text selectable style={[styles.factValue, { color: theme.text }]}>
        {value}
      </Text>
    </View>
  );
}

function getRole(user: object): string {
  return "role" in user && typeof user.role === "string" ? user.role : "user";
}

const styles = StyleSheet.create({
  header: { gap: 8, paddingTop: 8 },
  title: { fontSize: 34, lineHeight: 39, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  cardTitle: { fontSize: 20, lineHeight: 25, fontWeight: "700" },
  fact: { gap: 3 },
  factLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  factValue: { fontSize: 16, lineHeight: 23, fontWeight: "600" },
});
