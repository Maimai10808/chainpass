import { tones } from "./tokens";
import type { Tone } from "./tokens";

/** Presentation only. Validity, chain verification and authorization remain API facts. */
export const statusTone = {
  ACTIVE: "success",
  PUBLISHED: "success",
  DRAFT: "neutral",
  PENDING: "warning",
  MINTING: "violet",
  ON_CHAIN: "info",
  ON_CHAIN_VERIFIED: "info",
  CHECKED_IN: "info",
  REVOKED: "danger",
  ERROR: "danger",
} as const satisfies Record<string, Tone>;
export type VisualStatus = keyof typeof statusTone;
export function getStatusTone(status: string): Tone {
  return Object.hasOwn(statusTone, status)
    ? statusTone[status as VisualStatus]
    : "neutral";
}
export function getStatusColors(status: string) {
  return tones[getStatusTone(status)];
}
/** Literal utilities: never construct bg-${tone} at runtime. */
export const statusClasses = {
  success: "bg-success-muted text-success border-success-border",
  warning: "bg-warning-muted text-warning border-warning-border",
  danger: "bg-danger-muted text-danger border-danger-border",
  info: "bg-info-muted text-info border-info-border",
  neutral: "bg-neutral-muted text-neutral border-neutral-border",
  violet: "bg-violet-muted text-violet border-violet-border",
} as const satisfies Record<Tone, string>;
export function getStatusClasses(status: string): string {
  return statusClasses[getStatusTone(status)];
}
