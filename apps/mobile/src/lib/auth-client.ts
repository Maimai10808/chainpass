import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { adminClient } from "better-auth/client/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import * as SecureStore from "expo-secure-store";
import { authEndpoint } from "./product";

const baseURL = process.env.EXPO_PUBLIC_API_URL;

if (!baseURL) {
  throw new Error("EXPO_PUBLIC_API_URL is not set");
}

export const authClient = createAuthClient({
  baseURL: authEndpoint(baseURL),

  plugins: [
    adminClient({ roles: { admin: adminAc, merchant: userAc, user: userAc } }),
    expoClient({
      scheme: "chainpass",
      storagePrefix: "chainpass",
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
