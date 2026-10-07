import { ApiClientError } from "@chainpass/api-client";

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatPrice(value: string) {
  return value === "0" ? "Free" : `${value} minor units`;
}

export function shorten(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401)
      return "Your session expired. Please sign in again.";
    if (error.status === 403) return "You do not have access to this resource.";
    if (error.status === 404) return "This resource is not available.";
    if (error.status >= 500)
      return "The service is temporarily unavailable. Please retry.";
    return error.message;
  }
  return "Unable to connect. Check your connection and try again.";
}

export const optionalText = (value: unknown) =>
  typeof value === "string" && !value.trim() ? undefined : value;
export function localDateToIso(value: unknown) {
  if (typeof value !== "string" || !value) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
