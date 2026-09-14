-- PASS 13: persist technical and business-facing incident closure summaries.

ALTER TABLE "Incident"
  ADD COLUMN "closureTechnicalSummary" TEXT,
  ADD COLUMN "closureBusinessSummary" TEXT;
