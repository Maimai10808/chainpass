import { createApiClient } from "@chainpass/api-client";
import { Platform } from "react-native";

import { authClient } from "./auth-client";

const baseUrl = process.env.EXPO_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not set");
}

const authenticatedFetch: typeof globalThis.fetch = async (input, init) => {
  if (Platform.OS === "web") return globalThis.fetch(input, init);

  const headers = new Headers(init?.headers);
  const cookie = await authClient.getCookie();
  if (cookie) headers.set("Cookie", cookie);

  return globalThis.fetch(input, { ...init, headers });
};

export const apiClient = createApiClient({
  baseUrl,
  fetch: authenticatedFetch,
});
