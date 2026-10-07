import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "./api-client";

export const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => apiClient.listPublishedEvents(),
});
export const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["event", id],
    queryFn: () => apiClient.getPublishedEvent(id),
  });
export const passesQuery = (userId?: string) =>
  queryOptions({
    queryKey: ["my-passes", userId],
    queryFn: () => apiClient.getMyPasses(),
    enabled: Boolean(userId),
  });
export const walletQuery = (userId?: string) =>
  queryOptions({
    queryKey: ["wallet", userId],
    queryFn: () => apiClient.getMyWallet(),
    enabled: Boolean(userId),
  });
export const merchantEventsQuery = (userId?: string) =>
  queryOptions({
    queryKey: ["merchant-events", userId],
    queryFn: () => apiClient.listMyEvents(),
    enabled: Boolean(userId),
  });
export const adminEventsQuery = queryOptions({
  queryKey: ["admin-events"],
  queryFn: () => apiClient.listAdminEvents(),
});
