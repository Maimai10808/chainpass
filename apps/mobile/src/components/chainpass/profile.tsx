import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut, useSession } from "@/lib/auth-client";
import { getRole } from "@/lib/product";
import { walletKit } from "@/lib/wallet";
import { colors, radius, spacing } from "@/design";
import {
  Screen,
  Heading,
  Card,
  Fact,
  StatusPill,
  ActionButton,
  Feedback,
  Sheet,
  text,
} from "./ui";
import { WalletPanel } from "./wallet-panel";
import { pendingInvitation } from "@/lib/pending-invitation";
export function Profile() {
  const { data: session } = useSession();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const result = await signOut();
      if (result.error) throw new Error("Sign out failed");
      client.clear();
      await pendingInvitation.clear();
      await walletKit?.disconnect().catch(() => {});
      router.replace("/");
    } catch {
      setError("Unable to sign out. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Heading
        title="Your identity."
        description="One account. Every experience."
      />
      {session ? (
        <>
          <Card>
            <View
              style={{
                width: 64,
                height: 64,
                backgroundColor: colors.primary,
                borderRadius: radius.xl,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={text.heading}>
                {session.user.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <StatusPill
              label={getRole(session.user).toUpperCase()}
              tone="info"
            />
            <Fact label="Name" value={session.user.name} />
            <Fact label="Email" value={session.user.email} />
            <Fact label="Network" value="Ethereum Sepolia · Testnet" />
          </Card>
          <WalletPanel />
          <ActionButton
            tone="danger"
            label="Sign out"
            onPress={() => setConfirm(true)}
          />
          <Sheet
            visible={confirm}
            title="Sign out?"
            onClose={() => {
              if (!busy) setConfirm(false);
            }}
          >
            <Text style={text.body}>
              Your passes remain tied to your account. Sign in again to access
              them.
            </Text>
            <View style={{ gap: spacing[16] }}>
              {Boolean(error) && <Feedback message={error} />}
              <ActionButton
                tone="danger"
                label="Confirm sign out"
                loading={busy}
                onPress={() => void logout()}
              />
            </View>
          </Sheet>
        </>
      ) : (
        <Card>
          <Text style={text.heading}>Carry your experiences.</Text>
          <Text style={text.body}>
            Sign in to claim passes and present your secure entry code.
          </Text>
          <ActionButton
            label="Sign in"
            onPress={() => router.push("/auth/sign-in")}
          />
          <ActionButton
            tone="secondary"
            label="Create account"
            onPress={() => router.push("/auth/sign-up")}
          />
        </Card>
      )}
    </Screen>
  );
}
