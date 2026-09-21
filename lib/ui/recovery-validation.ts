import { REQUIRED_VALIDATION_DEFINITIONS } from "@/lib/domain/validation";
import type { IncidentStatus, ValidationStatus } from "@/lib/domain/types";
import {
  deriveRecoveryValidationEvidence,
  recoveryEvidencePassCount,
  type RecoveryValidationEvidence,
  type RecoveryValidationInput
} from "@/lib/evidence/recovery-validation";

export type RecoveryValidationMode = "LOCKED" | "READY" | "BLOCKED" | "VALIDATED" | "INCONSISTENT";

export interface PersistedValidationCheck {
  id: string;
  key: string;
  label: string;
  required: boolean;
  status: ValidationStatus;
}

export interface RecoveryValidationViewInput extends RecoveryValidationInput {
  validation: PersistedValidationCheck[];
}

export interface RecoveryValidationView {
  mode: RecoveryValidationMode;
  evidence: RecoveryValidationEvidence;
  evidencePassCount: number;
  persistedPassCount: number;
  canonicalSchemaComplete: boolean;
  allCanonicalPending: boolean;
  allCanonicalPassed: boolean;
  validationStarted: boolean;
  validationPassedAudit: boolean;
}

const POST_VALIDATION_STATES: readonly IncidentStatus[] = ["VALIDATED", "RESOLVED"];

function canonicalValidationState(validation: PersistedValidationCheck[]) {
  const expected = new Set<string>(REQUIRED_VALIDATION_DEFINITIONS.map((definition) => definition.id));
  const canonical = validation.filter((check) => expected.has(check.key));
  const keys = canonical.map((check) => check.key);
  const unique = new Set(keys);

  const canonicalSchemaComplete =
    validation.length === REQUIRED_VALIDATION_DEFINITIONS.length &&
    canonical.length === REQUIRED_VALIDATION_DEFINITIONS.length &&
    unique.size === REQUIRED_VALIDATION_DEFINITIONS.length &&
    REQUIRED_VALIDATION_DEFINITIONS.every((definition) =>
      canonical.some(
        (check) =>
          check.key === definition.id &&
          check.required === true &&
          check.label === definition.label
      )
    );

  return {
    canonical,
    canonicalSchemaComplete,
    allCanonicalPending:
      canonicalSchemaComplete && canonical.every((check) => check.status === "PENDING"),
    allCanonicalPassed:
      canonicalSchemaComplete && canonical.every((check) => check.status === "PASS"),
    persistedPassCount: canonical.filter((check) => check.required && check.status === "PASS").length
  };
}

export function recoveryValidationView(input: RecoveryValidationViewInput): RecoveryValidationView {
  const evidence = deriveRecoveryValidationEvidence(input);
  const evidencePassCount = recoveryEvidencePassCount(evidence);
  const persisted = canonicalValidationState(input.validation);
  const validationStarted = input.audit.some((event) => event.type === "VALIDATION_STARTED");
  const validationPassedAudit = input.audit.some((event) => event.type === "VALIDATION_PASSED");
  const status = input.incident?.status;

  let mode: RecoveryValidationMode = "LOCKED";

  if (status === "READY_FOR_VALIDATION") {
    if (!persisted.canonicalSchemaComplete || !persisted.allCanonicalPending || validationPassedAudit) {
      mode = "INCONSISTENT";
    } else {
      mode = evidencePassCount === 4 ? "READY" : "BLOCKED";
    }
  } else if (status && POST_VALIDATION_STATES.includes(status)) {
    mode =
      persisted.canonicalSchemaComplete &&
      persisted.allCanonicalPassed &&
      evidencePassCount === 4 &&
      validationStarted &&
      validationPassedAudit
        ? "VALIDATED"
        : "INCONSISTENT";
  }

  return {
    mode,
    evidence,
    evidencePassCount,
    persistedPassCount: persisted.persistedPassCount,
    canonicalSchemaComplete: persisted.canonicalSchemaComplete,
    allCanonicalPending: persisted.allCanonicalPending,
    allCanonicalPassed: persisted.allCanonicalPassed,
    validationStarted,
    validationPassedAudit
  };
}
