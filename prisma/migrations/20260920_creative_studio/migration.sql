CREATE TABLE "CreativeContent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT NOT NULL,
    "callToAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceName" TEXT,
    "sourceVerified" BOOLEAN NOT NULL DEFAULT false,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "factsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "brandSettings" JSONB NOT NULL DEFAULT '{}',
    "reviewNotes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeContent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreativeContent_organizationId_status_idx" ON "CreativeContent"("organizationId", "status");
CREATE INDEX "CreativeContent_organizationId_type_idx" ON "CreativeContent"("organizationId", "type");
ALTER TABLE "CreativeContent" ADD CONSTRAINT "CreativeContent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
