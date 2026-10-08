import { ApiClientError } from "@chainpass/api-client";
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const messages: Record<string, string> = {
      INVITATION_REQUIRED:
        "Open the organizer's invitation link to claim this ticket.",
      INVALID_INVITATION:
        "Invalid invitation. Ask the organizer for a complete link.",
      INVITATION_EXPIRED:
        "This invitation expired. Ask the organizer for a new link.",
      INVITATION_REVOKED:
        "The organizer revoked this invitation. Already issued passes remain valid.",
      INVITATION_EXHAUSTED: "This invitation has reached its claim limit.",
      INVITATION_UNAVAILABLE: "This invitation is no longer available.",
      INVITATION_NOT_FOUND: "This invitation is no longer available.",
      PASS_ALREADY_CLAIMED:
        "You already have this ticket type. Open My Passes.",
      TICKET_TYPE_SOLD_OUT: "This ticket type has sold out.",
      PASS_ALREADY_CHECKED_IN: "This pass has already been checked in.",
      PASS_REVOKED: "This pass is revoked and cannot be used.",
      INVALID_QR_TOKEN:
        "Invalid QR. Ask the attendee to open their ChainPass ticket.",
      QR_TOKEN_EXPIRED:
        "QR expired. Ask the attendee to refresh their pass, then scan again.",
    };
    if (error.code && messages[error.code]) return messages[error.code];
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403)
      return "You do not have permission to access this resource.";
    if (error.status === 404) return "Not found or no longer available.";
    if (error.status === 409)
      return "The state changed. Refresh and try again.";
    if (error.status === 400)
      return "Check your details. This action is not currently allowed.";
    if (error.status >= 500)
      return "Service temporarily unavailable. Please try again shortly.";
  }
  return "Unable to connect. Check your internet connection and try again.";
}
