CREATE TYPE "EventAccessMode" AS ENUM ('PUBLIC', 'INVITE_ONLY');
-- Existing published events remain publicly accessible. New API-created events default to INVITE_ONLY.
ALTER TABLE "Event" ADD COLUMN "accessMode" "EventAccessMode" NOT NULL DEFAULT 'PUBLIC';
DROP INDEX "Event_status_startsAt_idx";
CREATE INDEX "Event_status_accessMode_startsAt_idx" ON "Event"("status", "accessMode", "startsAt");

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Invitation_usage_check" CHECK ("maxUses" > 0 AND "usedCount" >= 0 AND "usedCount" <= "maxUses")
);
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_ticketTypeId_createdAt_idx" ON "Invitation"("ticketTypeId", "createdAt");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Pass" ADD COLUMN "invitationId" TEXT;
CREATE INDEX "Pass_invitationId_idx" ON "Pass"("invitationId");
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
