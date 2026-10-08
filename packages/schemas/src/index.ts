import { z } from "zod";

export const eventStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
export const eventAccessModeSchema = z.enum(["PUBLIC", "INVITE_ONLY"]);
export const ticketTypeStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const createEventInputSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required").max(200),
    description: z.string().trim().max(5_000).optional(),
    coverImageUrl: z.url("Cover image URL must be a valid URL").optional(),
    location: z.string().trim().max(500).optional(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    accessMode: eventAccessModeSchema.optional(),
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
    accessMode: eventAccessModeSchema,
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

export const managedEventSummarySchema = eventResponseSchema.extend({
  organizer: z.object({ id: z.string(), name: z.string() }).strict(),
  ticketTypeCount: z.number().int().nonnegative(),
});
export const managedEventListSchema = z.array(managedEventSummarySchema);

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
  organizer: z.object({ name: z.string() }).strict(),
});

export const publicEventListSchema = z.array(publicEventSummarySchema);

export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Invalid invitation credential");
export const createInvitationInputSchema = z
  .object({
    ticketTypeId: z.string().min(1),
    maxUses: z.number().int().positive().max(2_147_483_647),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const resolveInvitationInputSchema = z
  .object({ token: invitationTokenSchema })
  .strict();
export const claimPassInputSchema = z
  .object({ invitationToken: invitationTokenSchema.optional() })
  .strict();
export const invitationViewSchema = z
  .object({
    id: z.string(),
    ticketTypeId: z.string(),
    ticketTypeName: z.string(),
    maxUses: z.number().int().positive(),
    usedCount: z.number().int().nonnegative(),
    expiresAt: z.iso.datetime({ offset: true }),
    revokedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const invitationListSchema = z.array(invitationViewSchema);
export const createInvitationResponseSchema = z
  .object({
    invitation: invitationViewSchema,
    token: invitationTokenSchema,
  })
  .strict();
export const invitationPreviewSchema = z
  .object({
    event: publicEventSummarySchema.extend({
      organizer: z.object({ name: z.string() }).strict(),
    }),
    ticketType: publicTicketTypeSchema,
    expiresAt: z.iso.datetime({ offset: true }),
    remainingUses: z.number().int().nonnegative(),
  })
  .strict();
export const invitationErrorSchema = z.enum([
  "INVITATION_REQUIRED",
  "INVALID_INVITATION",
  "INVITATION_EXPIRED",
  "INVITATION_REVOKED",
  "INVITATION_EXHAUSTED",
  "INVITATION_UNAVAILABLE",
]);

export const passStatusSchema = z.enum(["ACTIVE", "CHECKED_IN", "REVOKED"]);
export const onChainStatusSchema = z.enum(["OFF_CHAIN", "ON_CHAIN_VERIFIED"]);
export const verificationStatusSchema = z.enum([
  "VALID",
  "ALREADY_CHECKED_IN",
  "REVOKED",
  "INVALID",
]);
export const passVerificationOnChainStatusSchema = z.enum([
  "VERIFIED",
  "NOT_MINTED",
  "MISMATCH",
  "UNAVAILABLE",
]);
export const checkInMethodSchema = z.enum(["MANUAL", "QR"]);
export const checkInInputSchema = z
  .object({
    method: checkInMethodSchema.default("MANUAL"),
  })
  .strict();
export const evmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Wallet address must be a valid EVM address");

export const createWalletChallengeInputSchema = z
  .object({
    address: evmAddressSchema,
    chainId: z.number().int().positive(),
  })
  .strict();

export const walletChallengeResponseSchema = z
  .object({
    id: z.string(),
    address: evmAddressSchema,
    chainId: z.number().int().positive(),
    message: z.string().min(1),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const verifyWalletInputSchema = z
  .object({
    challengeId: z.string().min(1),
    address: evmAddressSchema,
    signature: z
      .string()
      .regex(/^0x[0-9a-fA-F]+$/, "Signature must be hex encoded"),
  })
  .strict();

export const walletViewSchema = z
  .object({
    id: z.string(),
    address: evmAddressSchema,
    chainId: z.number().int().positive(),
    verifiedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const myWalletResponseSchema = walletViewSchema.nullable();

export const passViewSchema = z
  .object({
    id: z.string(),
    status: passStatusSchema,
    tokenId: z.string().nullable(),
    mintTxHash: z.string().nullable(),
    contractAddress: z.string().nullable(),
    chainId: z.number().int().positive().nullable(),
    onChainStatus: onChainStatusSchema,
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
  .strict()
  .superRefine((pass, context) => {
    const onChainFields = [
      pass.tokenId,
      pass.mintTxHash,
      pass.contractAddress,
      pass.chainId,
    ];
    const hasAllOnChainFields = onChainFields.every((value) => value !== null);
    const hasNoOnChainFields = onChainFields.every((value) => value === null);

    if (
      (pass.onChainStatus === "ON_CHAIN_VERIFIED" && !hasAllOnChainFields) ||
      (pass.onChainStatus === "OFF_CHAIN" && !hasNoOnChainFields)
    ) {
      context.addIssue({
        code: "custom",
        message: "Pass on-chain status does not match its mint metadata",
        path: ["onChainStatus"],
      });
    }
  });

export const claimPassResultSchema = z
  .object({
    pass: passViewSchema,
    remaining: z.number().int().nonnegative(),
  })
  .strict();

export const myPassesResponseSchema = z.array(passViewSchema);

export const mintPassResultSchema = z
  .object({
    pass: passViewSchema,
    recovered: z.boolean(),
  })
  .strict();

export const verifyPassResponseSchema = z
  .object({
    verificationStatus: verificationStatusSchema,
    onChainStatus: passVerificationOnChainStatusSchema,
    canCheckIn: z.boolean(),
    pass: z
      .object({
        id: z.string(),
        status: passStatusSchema,
        tokenId: z.string().nullable(),
        mintTxHash: z.string().nullable(),
        contractAddress: z.string().nullable(),
        chainId: z.number().int().positive().nullable(),
        createdAt: z.iso.datetime({ offset: true }),
      })
      .strict(),
    event: z
      .object({
        id: z.string(),
        name: z.string(),
        startsAt: z.iso.datetime({ offset: true }),
        location: z.string().nullable(),
      })
      .strict(),
    ticketType: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .strict(),
    holder: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.email(),
      })
      .strict(),
    checkIn: z
      .object({
        id: z.string(),
        method: checkInMethodSchema,
        verifiedAt: z.iso.datetime({ offset: true }),
        verifiedBy: z
          .object({
            id: z.string(),
            name: z.string(),
            email: z.email(),
          })
          .strict(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const checkInResponseSchema = verifyPassResponseSchema;

export const passVerificationTokenResponseSchema = z
  .object({
    token: z.string().min(1),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const verifyQrTokenInputSchema = z
  .object({
    token: z.string().min(1, "Verification token is required"),
  })
  .strict();

export const verifyQrTokenResponseSchema = verifyPassResponseSchema;
export const qrVerificationErrorSchema = z.enum([
  "INVALID_QR_TOKEN",
  "QR_TOKEN_EXPIRED",
]);

export type CreateEventInput = z.infer<typeof createEventInputSchema>;
export type EventResponse = z.infer<typeof eventResponseSchema>;
export type ManagedEventSummary = z.infer<typeof managedEventSummarySchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type EventAccessMode = z.infer<typeof eventAccessModeSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationInputSchema>;
export type ResolveInvitationInput = z.infer<
  typeof resolveInvitationInputSchema
>;
export type ClaimPassInput = z.infer<typeof claimPassInputSchema>;
export type InvitationView = z.infer<typeof invitationViewSchema>;
export type CreateInvitationResponse = z.infer<
  typeof createInvitationResponseSchema
>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
export type InvitationError = z.infer<typeof invitationErrorSchema>;
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeInputSchema>;
export type TicketTypeResponse = z.infer<typeof ticketTypeResponseSchema>;
export type TicketTypeStatus = z.infer<typeof ticketTypeStatusSchema>;
export type PublicEventSummary = z.infer<typeof publicEventSummarySchema>;
export type PublicTicketType = z.infer<typeof publicTicketTypeSchema>;
export type PublicEventDetail = z.infer<typeof publicEventDetailSchema>;
export type PassStatus = z.infer<typeof passStatusSchema>;
export type OnChainStatus = z.infer<typeof onChainStatusSchema>;
export type PassView = z.infer<typeof passViewSchema>;
export type ClaimPassResult = z.infer<typeof claimPassResultSchema>;
export type CreateWalletChallengeInput = z.infer<
  typeof createWalletChallengeInputSchema
>;
export type WalletChallengeResponse = z.infer<
  typeof walletChallengeResponseSchema
>;
export type VerifyWalletInput = z.infer<typeof verifyWalletInputSchema>;
export type WalletView = z.infer<typeof walletViewSchema>;
export type MintPassResult = z.infer<typeof mintPassResultSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type PassVerificationOnChainStatus = z.infer<
  typeof passVerificationOnChainStatusSchema
>;
export type CheckInMethod = z.infer<typeof checkInMethodSchema>;
export type CheckInInput = z.infer<typeof checkInInputSchema>;
export type VerifyPassResponse = z.infer<typeof verifyPassResponseSchema>;
export type CheckInResponse = z.infer<typeof checkInResponseSchema>;
export type PassVerificationTokenResponse = z.infer<
  typeof passVerificationTokenResponseSchema
>;
export type VerifyQrTokenInput = z.infer<typeof verifyQrTokenInputSchema>;
export type VerifyQrTokenResponse = z.infer<typeof verifyQrTokenResponseSchema>;
export type QrVerificationError = z.infer<typeof qrVerificationErrorSchema>;
