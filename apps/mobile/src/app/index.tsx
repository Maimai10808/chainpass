import { useState } from "react";
import {
  Button,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  signIn,
  signOut,
  signUp,
  useSession,
} from "../lib/auth-client";

export default function HomeScreen() {
  const { data: session, isPending } = useSession();

  const [name, setName] = useState("Mobile Test User");
  const [email, setEmail] = useState("mobile-user@chainpass.local");
  const [password, setPassword] = useState("ChainPass123!");
  const [message, setMessage] = useState("");

  async function handleSignUp() {
    setMessage("");

    const result = await signUp.email({
      name,
      email,
      password,
    });

    if (result.error) {
      setMessage(`Sign up failed: ${result.error.message}`);
      return;
    }

    setMessage("Sign up successful");
  }

  async function handleSignIn() {
    setMessage("");

    const result = await signIn.email({
      email,
      password,
    });

    if (result.error) {
      setMessage(`Sign in failed: ${result.error.message}`);
      return;
    }

    setMessage("Sign in successful");
  }

  async function handleSignOut() {
    await signOut();
    setMessage("Signed out");
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>
        ChainPass Auth Test
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 12,
          borderRadius: 8,
        }}
      />

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 12,
          borderRadius: 8,
        }}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 12,
          borderRadius: 8,
        }}
      />

      <View style={{ gap: 10 }}>
        <Button title="Sign Up" onPress={handleSignUp} />
        <Button title="Sign In" onPress={handleSignIn} />
        <Button title="Sign Out" onPress={handleSignOut} />
      </View>

      {message ? (
        <Text style={{ fontWeight: "600" }}>{message}</Text>
      ) : null}

      <View
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 16,
          borderRadius: 12,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
          Current Session
        </Text>

        {isPending ? (
          <Text>Loading session...</Text>
        ) : session ? (
          <>
            <Text>ID: {session.user.id}</Text>
            <Text>Name: {session.user.name}</Text>
            <Text>Email: {session.user.email}</Text>
            <Text>Role: {session.user.role ?? "user"}</Text>
          </>
        ) : (
          <Text>Not signed in</Text>
        )}
      </View>
    </ScrollView>
  );
}
