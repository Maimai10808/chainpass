import { useQueryClient } from "@tanstack/react-query";
import { type Href, Link, router, useLocalSearchParams } from "expo-router";
import { type ComponentProps, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ActionButton, Card, ScreenState, layoutStyles } from "./ui";
import { useTheme } from "@/hooks/use-theme";
import { signIn, signUp, useSession } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { data: session, isPending: sessionPending } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignUp = mode === "sign-up";

  function continueToApp() {
    const destination = returnTo?.startsWith("/")
      ? (returnTo as Href)
      : ("/" as Href);
    router.replace(destination);
  }

  async function submit() {
    if (
      submitting ||
      !email.trim() ||
      password.length < 8 ||
      (isSignUp && !name.trim())
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      const result = isSignUp
        ? await signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(
          result.error.message ??
            `Unable to ${isSignUp ? "create the account" : "sign in"}.`,
        );
        return;
      }
      await queryClient.invalidateQueries();
      continueToApp();
    } catch {
      setError("Network unavailable. Check the API address and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionPending)
    return <ScreenState loading title="Restoring your session…" />;
  if (session) {
    return (
      <ScreenState
        action={<ActionButton label="Continue" onPress={continueToApp} />}
        description={`Signed in as ${session.user.email}`}
        title="You are signed in"
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        layoutStyles.screen,
        { backgroundColor: theme.backgroundElement },
      ]}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>
            CHAINPASS
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>
            {isSignUp ? "Create your account" : "Welcome back"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {isSignUp
              ? "One account keeps every pass and session connected."
              : "Sign in to claim and present your event passes."}
          </Text>
        </View>
        <Card>
          {isSignUp ? (
            <Field
              autoComplete="name"
              label="Name"
              onChangeText={setName}
              placeholder="Your name"
              value={name}
            />
          ) : null}
          <Field
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="you@example.com"
            value={email}
          />
          <Field
            autoCapitalize="none"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            label="Password"
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            value={password}
          />
          {error ? (
            <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
          ) : null}
          <ActionButton
            disabled={
              !email.trim() || password.length < 8 || (isSignUp && !name.trim())
            }
            label={isSignUp ? "Create account" : "Sign in"}
            loading={submitting}
            onPress={() => void submit()}
          />
        </Card>
        <View style={styles.switchRow}>
          <Text style={{ color: theme.textSecondary }}>
            {isSignUp ? "Already have an account?" : "New to ChainPass?"}
          </Text>
          <Link
            href={{
              pathname: isSignUp ? "/auth/sign-in" : "/auth/sign-up",
              params: returnTo ? { returnTo } : {},
            }}
            replace
          >
            <Text style={[styles.link, { color: theme.primary }]}>
              {isSignUp ? "Sign in" : "Create account"}
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = ComponentProps<typeof TextInput> & { label: string };

function Field({ label, style, ...props }: FieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        autoCorrect={false}
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.primary}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            color: theme.text,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: 22, gap: 22 },
  heading: { gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.8 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "800" },
  subtitle: { fontSize: 16, lineHeight: 23 },
  field: { gap: 7 },
  label: { fontSize: 14, fontWeight: "700" },
  input: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { fontSize: 14, lineHeight: 20 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  link: { fontWeight: "700" },
});
