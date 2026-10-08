import { useEffect, useRef, useState } from "react";
import { router, Link, type Href, useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { View, Text } from "react-native";
import { authClient, signIn, signUp, useSession } from "@/lib/auth-client";
import { authDestination, getRole, type Role } from "@/lib/product";
import { triggerHaptic } from "@/design";
import {
  Screen,
  Heading,
  Card,
  Field,
  ActionButton,
  Feedback,
  text,
  layoutStyles,
} from "./ui";
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { data: session, isPending } = useSession();
  const client = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState<{
    id: string;
    role: Role;
  } | null>(null);
  const navigated = useRef(false);
  useEffect(() => {
    // A fresh getSession response can arrive before useSession publishes it.
    // Wait for the same verified identity before entering a protected route.
    if (
      authenticated &&
      !isPending &&
      session?.user.id === authenticated.id &&
      getRole(session.user) === authenticated.role &&
      !navigated.current
    ) {
      navigated.current = true;
      router.replace(authDestination(authenticated.role, returnTo) as Href);
    }
  }, [authenticated, isPending, session, returnTo]);
  const signup = mode === "sign-up";
  const set = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  async function submit() {
    if (busy) return;
    const valid = z
      .object({ email: z.email(), password: z.string().min(8).max(128) })
      .safeParse({ email: form.email.trim(), password: form.password });
    if (
      !valid.success ||
      (signup && (!form.name.trim() || form.password !== form.confirm))
    ) {
      setError(
        "Enter a valid email and an 8–128 character password. Add your name and matching passwords for registration.",
      );
      return;
    }
    setBusy(true);
    setError("");
    navigated.current = false;
    try {
      const result = signup
        ? await signUp.email({ name: form.name.trim(), ...valid.data })
        : await signIn.email(valid.data);
      if (result.error) {
        setError(
          result.error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "Email or password is incorrect."
            : signup
              ? "Unable to create this account. Try another email or sign in."
              : "Unable to sign in. Check your credentials.",
        );
        return;
      }
      const fresh = await authClient.getSession({
        query: { disableCookieCache: true },
      });
      if (fresh.error || !fresh.data?.user) {
        setError(
          "Your session could not be restored. Check your connection and try again.",
        );
        return;
      }
      client.removeQueries({ queryKey: ["private"] });
      void triggerHaptic("success");
      setAuthenticated({
        id: fresh.data.user.id,
        role: getRole(fresh.data.user),
      });
    } catch {
      setError("Network unavailable. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen keyboard>
      <Heading
        title={signup ? "Your next experience starts here." : "Welcome back."}
        description={
          signup
            ? "Create an account to collect passes and carry them with you."
            : "Your events, passes and workspace, all in one place."
        }
      />
      {session ? (
        <Card>
          <Text style={text.body}>
            You’re signed in as {session.user.name}.
          </Text>
          <ActionButton
            label="Continue"
            onPress={() =>
              router.replace(
                authDestination(getRole(session.user), returnTo) as Href,
              )
            }
          />
        </Card>
      ) : (
        <Card>
          {signup && (
            <Field
              label="Name"
              autoComplete="name"
              value={form.name}
              onChangeText={(value) => set("name", value)}
            />
          )}
          <Field
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(value) => set("email", value)}
          />
          <Field
            label="Password"
            autoCapitalize="none"
            autoComplete={signup ? "new-password" : "current-password"}
            secureTextEntry={!visible}
            value={form.password}
            onChangeText={(value) => set("password", value)}
          />
          {signup && (
            <Field
              label="Confirm password"
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry={!visible}
              value={form.confirm}
              onChangeText={(value) => set("confirm", value)}
            />
          )}
          <ActionButton
            tone="secondary"
            label={visible ? "Hide passwords" : "Show passwords"}
            onPress={() => setVisible(!visible)}
          />
          {Boolean(error) && <Feedback message={error} />}
          <ActionButton
            label={signup ? "Create account" : "Sign in"}
            loading={busy}
            onPress={() => void submit()}
          />
        </Card>
      )}
      <View style={layoutStyles.section}>
        <Text style={text.body}>
          {signup ? "Already have an account?" : "New to ChainPass?"}
        </Text>
        <Link
          href={{
            pathname: signup ? "/auth/sign-in" : "/auth/sign-up",
            params: returnTo ? { returnTo } : {},
          }}
          replace
          style={text.label}
        >
          {signup ? "Sign in →" : "Create account →"}
        </Link>
      </View>
    </Screen>
  );
}
