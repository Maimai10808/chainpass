-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('MANUAL', 'QR');

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "verifiedById" TEXT NOT NULL,
    "method" "CheckInMethod" NOT NULL DEFAULT 'MANUAL',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_passId_key" ON "CheckIn"("passId");

-- CreateIndex
CREATE INDEX "CheckIn_eventId_verifiedAt_idx" ON "CheckIn"("eventId", "verifiedAt");

-- CreateIndex
CREATE INDEX "CheckIn_verifiedById_verifiedAt_idx" ON "CheckIn"("verifiedById", "verifiedAt");

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_passId_fkey" FOREIGN KEY ("passId") REFERENCES "Pass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
