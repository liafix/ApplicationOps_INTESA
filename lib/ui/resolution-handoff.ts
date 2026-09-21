import type { IncidentStatus, ValidationCheck } from "@/lib/domain/types";
import { deriveResolutionHandoff, type ResolutionHandoffInput } from "@/lib/evidence/resolution-handoff";

export type ResolutionHandoffMode = "LOCKED" | "READY" | "RESOLVED" | "INCONSISTENT";

export interface ResolutionHandoffViewInput extends ResolutionHandoffInput {
  incident: (NonNullable<ResolutionHandoffInput["incident"]> & {
    closureTechnicalSummary: string | null;
    closureBusinessSummary: string | null;
  }) | null;
}

export function resolutionHandoffView(input: ResolutionHandoffViewInput) {
  const derived = deriveResolutionHandoff(input);
  const status = input.incident?.status as IncidentStatus | undefined;
  const resolvedAudit = input.audit.some((event) => event.type === "INCIDENT_RESOLVED");
  const handoffAudit = input.audit.some((event) => event.type === "RESOLUTION_HANDOFF_CREATED");
  const hasSummaries = Boolean(input.incident?.closureTechnicalSummary && input.incident?.closureBusinessSummary);
  const summariesMatch = Boolean(
    derived.technicalSummary &&
    derived.businessSummary &&
    input.incident?.closureTechnicalSummary === derived.technicalSummary &&
    input.incident?.closureBusinessSummary === derived.businessSummary
  );

  if (status === "RESOLVED") {
    const consistent = derived.ready && hasSummaries && summariesMatch && resolvedAudit && handoffAudit;
    return { ...derived, mode: consistent ? "RESOLVED" as const : "INCONSISTENT" as const, resolvedAudit, handoffAudit, hasSummaries, summariesMatch };
  }
  if (status === "VALIDATED") {
    const consistent = !hasSummaries && !resolvedAudit && !handoffAudit;
    return { ...derived, mode: derived.ready && consistent ? "READY" as const : "INCONSISTENT" as const, resolvedAudit, handoffAudit, hasSummaries, summariesMatch };
  }
  return { ...derived, mode: "LOCKED" as const, resolvedAudit, handoffAudit, hasSummaries, summariesMatch };
}
