import {
  createEventInputSchema,
  createTicketTypeInputSchema,
  eventResponseSchema,
  publicEventDetailSchema,
  publicEventListSchema,
  ticketTypeListResponseSchema,
  ticketTypeResponseSchema,
  type CreateEventInput,
  type CreateTicketTypeInput,
  type EventResponse,
  type PublicEventDetail,
  type PublicEventSummary,
  type TicketTypeResponse,
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
  EventResponse,
  PublicEventDetail,
  PublicEventSummary,
  TicketTypeResponse,
} from "@chainpass/schemas";
