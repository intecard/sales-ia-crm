CREATE TABLE "PaymentRequest" (
 "id" TEXT NOT NULL PRIMARY KEY,"organizationId" TEXT NOT NULL,"contactId" TEXT,"token" TEXT NOT NULL,
 "amount" DECIMAL(12,2) NOT NULL,"currency" TEXT NOT NULL,"description" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'PENDING',
 "expiresAt" TIMESTAMP(3) NOT NULL,"paymentId" TEXT,"proofMeta" JSONB NOT NULL DEFAULT '{}',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PaymentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "PaymentRequest_token_key" ON "PaymentRequest"("token");
CREATE INDEX "PaymentRequest_organizationId_status_idx" ON "PaymentRequest"("organizationId","status");
ALTER TABLE "PaymentRequest" ENABLE ROW LEVEL SECURITY;
