import { z } from "zod";

export const eventStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);

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

export type CreateEventInput = z.infer<typeof createEventInputSchema>;
export type EventResponse = z.infer<typeof eventResponseSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
