/** Presentation only: these mappings never determine business validity. */
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
} as const;

export type VisualStatus = keyof typeof statusTone;
export type StatusTone = (typeof statusTone)[VisualStatus];

/** Literal classes let Tailwind discover every tone without runtime interpolation. */
export const statusClasses = {
  success: "border-success/25 bg-success/10 text-success",
  neutral: "border-neutral/25 bg-neutral/10 text-neutral",
  warning: "border-warning/25 bg-warning/10 text-warning",
  violet: "border-brand-violet/25 bg-brand-violet/10 text-brand-violet",
  info: "border-info/25 bg-info/10 text-info",
  danger: "border-danger/25 bg-danger/10 text-danger",
} as const satisfies Record<StatusTone, string>;

/** Unknown API values remain neutral rather than appearing valid/successful. */
export function getStatusClasses(status: string): string {
  const tone = Object.hasOwn(statusTone, status)
    ? statusTone[status as VisualStatus]
    : "neutral";
  return statusClasses[tone];
}
