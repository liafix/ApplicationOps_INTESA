-- PASS 2: PostgreSQL persistence for the deterministic synthetic ApplicationOps scenario.

CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'REGRESSION_CONFIRMED', 'REMEDIATION_SELECTED', 'ROLLING_BACK', 'READY_FOR_VALIDATION', 'VALIDATED', 'RESOLVED');
CREATE TYPE "ReleaseStatus" AS ENUM ('STABLE', 'DEPLOYED', 'DEGRADED', 'ROLLING_BACK', 'ROLLED_BACK');
CREATE TYPE "RemediationAction" AS ENUM ('RETRY_FAILED_TRANSACTIONS', 'CHANGE_PRODUCTION_DATA', 'ROLLBACK_RELEASE', 'ESCALATE_WITHOUT_ACTION');
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'PASS', 'FAIL');
CREATE TYPE "ServiceHealth" AS ENUM ('HEALTHY', 'DEGRADED');
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');
CREATE TYPE "SyntheticTransactionStatus" AS ENUM ('FAILED', 'SUCCEEDED');

CREATE TABLE "Application" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "serviceHealth" "ServiceHealth" NOT NULL,
  "activeReleaseVersion" TEXT NOT NULL,
  "syntheticErrorRate" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Release" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "ReleaseStatus" NOT NULL,
  "downstreamTimeoutMs" INTEGER NOT NULL,
  "syntheticErrorRate" DOUBLE PRECISION NOT NULL,
  "deployedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Incident" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" "IncidentStatus" NOT NULL,
  "requestSummary" TEXT NOT NULL,
  "technicalSummary" TEXT,
  "rootCauseCode" TEXT,
  "selectedRemediation" "RemediationAction",
  "affectedRelease" TEXT NOT NULL,
  "recoveredRelease" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosticLog" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "level" "LogLevel" NOT NULL,
  "requestId" TEXT,
  "service" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  CONSTRAINT "DiagnosticLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiRequest" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "responseStatus" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "releaseVersion" TEXT NOT NULL,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyntheticTransaction" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "status" "SyntheticTransactionStatus" NOT NULL,
  "applicationVersion" TEXT NOT NULL,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyntheticTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ValidationCheck" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "ValidationStatus" NOT NULL,
  CONSTRAINT "ValidationCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "metadata" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Release_applicationId_version_key" ON "Release"("applicationId", "version");
CREATE INDEX "Application_serviceHealth_idx" ON "Application"("serviceHealth");
CREATE INDEX "Release_applicationId_status_idx" ON "Release"("applicationId", "status");
CREATE INDEX "Release_applicationId_deployedAt_idx" ON "Release"("applicationId", "deployedAt");
CREATE INDEX "Incident_applicationId_status_idx" ON "Incident"("applicationId", "status");
CREATE INDEX "Incident_severity_createdAt_idx" ON "Incident"("severity", "createdAt");
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");
CREATE INDEX "DiagnosticLog_incidentId_timestamp_idx" ON "DiagnosticLog"("incidentId", "timestamp");
CREATE INDEX "DiagnosticLog_requestId_idx" ON "DiagnosticLog"("requestId");
CREATE INDEX "DiagnosticLog_level_timestamp_idx" ON "DiagnosticLog"("level", "timestamp");
CREATE INDEX "ApiRequest_incidentId_createdAt_idx" ON "ApiRequest"("incidentId", "createdAt");
CREATE INDEX "ApiRequest_requestId_idx" ON "ApiRequest"("requestId");
CREATE INDEX "ApiRequest_responseStatus_createdAt_idx" ON "ApiRequest"("responseStatus", "createdAt");
CREATE INDEX "SyntheticTransaction_incidentId_createdAt_idx" ON "SyntheticTransaction"("incidentId", "createdAt");
CREATE INDEX "SyntheticTransaction_requestId_idx" ON "SyntheticTransaction"("requestId");
CREATE INDEX "SyntheticTransaction_status_createdAt_idx" ON "SyntheticTransaction"("status", "createdAt");
CREATE UNIQUE INDEX "ValidationCheck_incidentId_key_key" ON "ValidationCheck"("incidentId", "key");
CREATE INDEX "ValidationCheck_incidentId_status_idx" ON "ValidationCheck"("incidentId", "status");
CREATE INDEX "AuditEvent_incidentId_timestamp_idx" ON "AuditEvent"("incidentId", "timestamp");
CREATE INDEX "AuditEvent_type_timestamp_idx" ON "AuditEvent"("type", "timestamp");

ALTER TABLE "Release" ADD CONSTRAINT "Release_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosticLog" ADD CONSTRAINT "DiagnosticLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiRequest" ADD CONSTRAINT "ApiRequest_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyntheticTransaction" ADD CONSTRAINT "SyntheticTransaction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidationCheck" ADD CONSTRAINT "ValidationCheck_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
