"use client";

import { useState } from "react";
import {
  signIn,
  signOut,
  signUp,
  useSession,
} from "@/lib/auth-client";

export default function AuthTestPage() {
  const { data: session, isPending } = useSession();

  const [name, setName] = useState("Web Test User");
  const [email, setEmail] = useState("web-user@chainpass.local");
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

  if (isPending) {
    return <main className="p-8">Loading session...</main>;
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 p-8">
      <h1 className="text-2xl font-bold">ChainPass Auth Test</h1>

      <div className="space-y-3">
        <input
          className="w-full border p-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
        />

        <input
          className="w-full border p-2"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
        />

        <input
          className="w-full border p-2"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />

        <div className="flex gap-2">
          <button
            className="border px-4 py-2"
            onClick={handleSignUp}
          >
            Sign Up
          </button>

          <button
            className="border px-4 py-2"
            onClick={handleSignIn}
          >
            Sign In
          </button>

          <button
            className="border px-4 py-2"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </div>

      {message && (
        <p className="font-medium">{message}</p>
      )}

      <section className="rounded border p-4">
        <h2 className="mb-3 font-semibold">Current Session</h2>

        {session ? (
          <pre className="overflow-auto text-sm">
            {JSON.stringify(
              {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                role: session.user.role,
              },
              null,
              2,
            )}
          </pre>
        ) : (
          <p>Not signed in</p>
        )}
      </section>
    </main>
  );
}
