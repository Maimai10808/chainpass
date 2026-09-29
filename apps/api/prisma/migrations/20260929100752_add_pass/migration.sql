-- CreateEnum
CREATE TYPE "PassStatus" AS ENUM ('ACTIVE', 'CHECKED_IN', 'REVOKED');

-- CreateTable
CREATE TABLE "Pass" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "PassStatus" NOT NULL DEFAULT 'ACTIVE',
    "tokenId" TEXT,
    "mintTxHash" TEXT,
    "contractAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pass_ownerId_createdAt_idx" ON "Pass"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Pass_eventId_idx" ON "Pass"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Pass_ticketTypeId_ownerId_key" ON "Pass"("ticketTypeId", "ownerId");

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
