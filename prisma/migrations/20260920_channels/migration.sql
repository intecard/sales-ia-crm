CREATE TABLE "ChannelEvent" ("id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,"provider" TEXT NOT NULL,"externalId" TEXT NOT NULL,"payload" JSONB NOT NULL,"status" TEXT NOT NULL DEFAULT 'PENDING',"conversationId" TEXT,"error" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "ChannelEvent_organizationId_provider_externalId_key" ON "ChannelEvent"("organizationId","provider","externalId");
CREATE INDEX "ChannelEvent_status_createdAt_idx" ON "ChannelEvent"("status","createdAt");
ALTER TABLE "ChannelEvent" ENABLE ROW LEVEL SECURITY;
