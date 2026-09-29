import { createApiClient } from "@chainpass/api-client";

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

export const apiClient = createApiClient({ baseUrl });
