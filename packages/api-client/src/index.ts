import {
  createEventInputSchema,
  eventResponseSchema,
  type CreateEventInput,
  type EventResponse,
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

export type { CreateEventInput, EventResponse } from "@chainpass/schemas";
