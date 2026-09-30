"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

const baseURL =
  process.env.NEXT_PUBLIC_AUTH_URL ?? process.env.NEXT_PUBLIC_API_URL;

if (!baseURL) {
  throw new Error("NEXT_PUBLIC_AUTH_URL or NEXT_PUBLIC_API_URL is not set");
}

export const authClient = createAuthClient({
  baseURL,

  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
