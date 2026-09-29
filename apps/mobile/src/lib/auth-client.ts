import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

const baseURL = process.env.EXPO_PUBLIC_API_URL;

if (!baseURL) {
  throw new Error("EXPO_PUBLIC_API_URL is not set");
}

export const authClient = createAuthClient({
  baseURL,

  plugins: [
    expoClient({
      scheme: "chainpass",
      storagePrefix: "chainpass",
      storage: SecureStore,
    }),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
