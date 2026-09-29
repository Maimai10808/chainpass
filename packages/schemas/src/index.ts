import { z } from "zod";

export const eventStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
export const ticketTypeStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const createEventInputSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required").max(200),
    description: z.string().trim().max(5_000).optional(),
    coverImageUrl: z.url("Cover image URL must be a valid URL").optional(),
    location: z.string().trim().max(500).optional(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((event) => new Date(event.endsAt) > new Date(event.startsAt), {
    message: "End time must be later than start time",
    path: ["endsAt"],
  });

export const eventResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    coverImageUrl: z.string().nullable(),
    location: z.string().nullable(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    status: eventStatusSchema,
    organizerId: z.string(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const createTicketTypeInputSchema = z
  .object({
    name: z.string().trim().min(1, "Ticket type name is required").max(200),
    description: z.string().trim().max(2_000).optional(),
    totalSupply: z
      .number()
      .int("Total supply must be an integer")
      .positive("Total supply must be greater than zero")
      .max(2_147_483_647),
    price: z
      .number()
      .int("Price must be an integer in minor currency units")
      .nonnegative("Price cannot be negative")
      .max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export const ticketTypeResponseSchema = z
  .object({
    id: z.string(),
    eventId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    price: z.string().regex(/^\d+$/),
    totalSupply: z.number().int().positive(),
    claimedCount: z.number().int().nonnegative(),
    status: ticketTypeStatusSchema,
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ticketTypeListResponseSchema = z.array(ticketTypeResponseSchema);

export const publicEventSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    coverImageUrl: z.string().nullable(),
    location: z.string().nullable(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    status: z.literal("PUBLISHED"),
  })
  .strict();

export const publicTicketTypeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    price: z.string().regex(/^\d+$/),
    totalSupply: z.number().int().positive(),
    claimedCount: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
    status: z.literal("ACTIVE"),
  })
  .strict();

export const publicEventDetailSchema = publicEventSummarySchema.extend({
  ticketTypes: z.array(publicTicketTypeSchema),
});

export const publicEventListSchema = z.array(publicEventSummarySchema);

export const passStatusSchema = z.enum(["ACTIVE", "CHECKED_IN", "REVOKED"]);

export const passViewSchema = z
  .object({
    id: z.string(),
    status: passStatusSchema,
    tokenId: z.string().nullable(),
    mintTxHash: z.string().nullable(),
    contractAddress: z.string().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    event: z
      .object({
        id: z.string(),
        name: z.string(),
        location: z.string().nullable(),
        startsAt: z.iso.datetime({ offset: true }),
        endsAt: z.iso.datetime({ offset: true }),
      })
      .strict(),
    ticketType: z
      .object({
        id: z.string(),
        name: z.string(),
        price: z.string().regex(/^\d+$/),
      })
      .strict(),
  })
  .strict();

export const claimPassResultSchema = z
  .object({
    pass: passViewSchema,
    remaining: z.number().int().nonnegative(),
  })
  .strict();

export const myPassesResponseSchema = z.array(passViewSchema);

export type CreateEventInput = z.infer<typeof createEventInputSchema>;
export type EventResponse = z.infer<typeof eventResponseSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeInputSchema>;
export type TicketTypeResponse = z.infer<typeof ticketTypeResponseSchema>;
export type TicketTypeStatus = z.infer<typeof ticketTypeStatusSchema>;
export type PublicEventSummary = z.infer<typeof publicEventSummarySchema>;
export type PublicTicketType = z.infer<typeof publicTicketTypeSchema>;
export type PublicEventDetail = z.infer<typeof publicEventDetailSchema>;
export type PassStatus = z.infer<typeof passStatusSchema>;
export type PassView = z.infer<typeof passViewSchema>;
export type ClaimPassResult = z.infer<typeof claimPassResultSchema>;
