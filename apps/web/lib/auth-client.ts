"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";

const baseURL =
  process.env.NEXT_PUBLIC_AUTH_URL ?? process.env.NEXT_PUBLIC_API_URL;

if (!baseURL) {
  throw new Error("NEXT_PUBLIC_AUTH_URL or NEXT_PUBLIC_API_URL is not set");
}

export const authClient = createAuthClient({
  baseURL,

  // Declare all server role names for the Admin plugin's typed client.
  // Merchant has no user-management privileges; business authorization remains server-side.
  plugins: [
    adminClient({ roles: { admin: adminAc, merchant: userAc, user: userAc } }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
