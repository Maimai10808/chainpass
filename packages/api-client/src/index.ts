import {
  createEventInputSchema,
  createTicketTypeInputSchema,
  createWalletChallengeInputSchema,
  checkInInputSchema,
  checkInResponseSchema,
  claimPassResultSchema,
  eventResponseSchema,
  mintPassResultSchema,
  passVerificationTokenResponseSchema,
  myWalletResponseSchema,
  publicEventDetailSchema,
  publicEventListSchema,
  myPassesResponseSchema,
  ticketTypeListResponseSchema,
  ticketTypeResponseSchema,
  verifyWalletInputSchema,
  verifyPassResponseSchema,
  verifyQrTokenInputSchema,
  verifyQrTokenResponseSchema,
  walletChallengeResponseSchema,
  walletViewSchema,
  type CreateEventInput,
  type CreateTicketTypeInput,
  type ClaimPassResult,
  type CheckInInput,
  type CheckInResponse,
  type CreateWalletChallengeInput,
  type EventResponse,
  type PublicEventDetail,
  type PublicEventSummary,
  type PassView,
  type MintPassResult,
  type PassVerificationTokenResponse,
  type TicketTypeResponse,
  type VerifyWalletInput,
  type WalletChallengeResponse,
  type WalletView,
  type VerifyPassResponse,
  type VerifyQrTokenInput,
  type VerifyQrTokenResponse,
} from "@chainpass/schemas";

export interface ChainPassApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function createApiClient(options: ChainPassApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetcher = options.fetch ?? globalThis.fetch;

  return {
    async createEvent(input: CreateEventInput): Promise<EventResponse> {
      const payload = createEventInputSchema.parse(input);
      const response = await fetcher(`${baseUrl}/events`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return eventResponseSchema.parse(await response.json());
    },

    async getManagedEvent(eventId: string): Promise<EventResponse> {
      const response = await fetcher(
        `${baseUrl}/events/${encodeURIComponent(eventId)}/manage`,
        { credentials: "include" },
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return eventResponseSchema.parse(await response.json());
    },

    async publishEvent(eventId: string): Promise<EventResponse> {
      const response = await fetcher(
        `${baseUrl}/events/${encodeURIComponent(eventId)}/publish`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return eventResponseSchema.parse(await response.json());
    },

    async listPublishedEvents(): Promise<PublicEventSummary[]> {
      const response = await fetcher(`${baseUrl}/events`);

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return publicEventListSchema.parse(await response.json());
    },

    async getPublishedEvent(eventId: string): Promise<PublicEventDetail> {
      const response = await fetcher(
        `${baseUrl}/events/${encodeURIComponent(eventId)}`,
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return publicEventDetailSchema.parse(await response.json());
    },

    async claimPass(ticketTypeId: string): Promise<ClaimPassResult> {
      const response = await fetcher(
        `${baseUrl}/ticket-types/${encodeURIComponent(ticketTypeId)}/claim`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return claimPassResultSchema.parse(await response.json());
    },

    async getMyPasses(): Promise<PassView[]> {
      const response = await fetcher(`${baseUrl}/passes/me`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return myPassesResponseSchema.parse(await response.json());
    },

    async createWalletChallenge(
      input: CreateWalletChallengeInput,
    ): Promise<WalletChallengeResponse> {
      const payload = createWalletChallengeInputSchema.parse(input);
      const response = await fetcher(`${baseUrl}/wallets/challenge`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return walletChallengeResponseSchema.parse(await response.json());
    },

    async verifyWallet(input: VerifyWalletInput): Promise<WalletView> {
      const payload = verifyWalletInputSchema.parse(input);
      const response = await fetcher(`${baseUrl}/wallets/verify`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return walletViewSchema.parse(await response.json());
    },

    async getMyWallet(): Promise<WalletView | null> {
      const response = await fetcher(`${baseUrl}/wallets/me`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return myWalletResponseSchema.parse(await response.json());
    },

    async mintPass(passId: string): Promise<MintPassResult> {
      const response = await fetcher(
        `${baseUrl}/passes/${encodeURIComponent(passId)}/mint`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return mintPassResultSchema.parse(await response.json());
    },

    async verifyPass(passId: string): Promise<VerifyPassResponse> {
      const response = await fetcher(
        `${baseUrl}/passes/${encodeURIComponent(passId)}/verify`,
        { credentials: "include" },
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return verifyPassResponseSchema.parse(await response.json());
    },

    async createPassVerificationToken(
      passId: string,
    ): Promise<PassVerificationTokenResponse> {
      const response = await fetcher(
        `${baseUrl}/passes/${encodeURIComponent(passId)}/verification-token`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return passVerificationTokenResponseSchema.parse(await response.json());
    },

    async verifyPassToken(
      input: VerifyQrTokenInput,
    ): Promise<VerifyQrTokenResponse> {
      const payload = verifyQrTokenInputSchema.parse(input);
      const response = await fetcher(`${baseUrl}/passes/verify-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return verifyQrTokenResponseSchema.parse(await response.json());
    },

    async checkInPass(
      passId: string,
      input: CheckInInput = { method: "MANUAL" },
    ): Promise<CheckInResponse> {
      const payload = checkInInputSchema.parse(input);
      const response = await fetcher(
        `${baseUrl}/passes/${encodeURIComponent(passId)}/check-in`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return checkInResponseSchema.parse(await response.json());
    },

    async createTicketType(
      eventId: string,
      input: CreateTicketTypeInput,
    ): Promise<TicketTypeResponse> {
      const payload = createTicketTypeInputSchema.parse(input);
      const response = await fetcher(
        `${baseUrl}/events/${encodeURIComponent(eventId)}/ticket-types`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return ticketTypeResponseSchema.parse(await response.json());
    },

    async listTicketTypes(eventId: string): Promise<TicketTypeResponse[]> {
      const response = await fetcher(
        `${baseUrl}/events/${encodeURIComponent(eventId)}/ticket-types`,
        { credentials: "include" },
      );

      if (!response.ok) {
        throw await toApiClientError(response);
      }

      return ticketTypeListResponseSchema.parse(await response.json());
    },
  };
}

async function toApiClientError(response: Response): Promise<ApiClientError> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (isRecord(body)) {
    const code = typeof body.code === "string" ? body.code : "API_ERROR";
    const message =
      typeof body.message === "string"
        ? body.message
        : `Request failed with status ${response.status}`;

    return new ApiClientError(response.status, code, message, body.details);
  }

  return new ApiClientError(
    response.status,
    "API_ERROR",
    `Request failed with status ${response.status}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export type {
  CreateEventInput,
  CreateTicketTypeInput,
  ClaimPassResult,
  CheckInInput,
  CheckInResponse,
  CreateWalletChallengeInput,
  EventResponse,
  PublicEventDetail,
  PublicEventSummary,
  PassView,
  MintPassResult,
  PassVerificationTokenResponse,
  TicketTypeResponse,
  VerifyWalletInput,
  VerifyPassResponse,
  VerifyQrTokenInput,
  VerifyQrTokenResponse,
  WalletChallengeResponse,
  WalletView,
} from "@chainpass/schemas";
