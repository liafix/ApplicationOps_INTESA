"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { SCENARIO } from "@/lib/data/synthetic-scenario";
import type { RemediationAction } from "@/lib/domain/types";
import {
  createPresentationState,
  presentationBeginRollback,
  presentationCompleteRollback,
  presentationConfirmRegression,
  presentationRecordRemediation,
  presentationResolve,
  presentationRunValidation,
  presentationStartInvestigation,
  type PresentationAuditView,
  type PresentationDiagnosticLogView,
  type PresentationIncidentView,
  type PresentationReleasesView,
  type PresentationRequestView,
  type PresentationRuntimeMode,
  type PresentationTransactionView,
  type PresentationValidationView
} from "@/lib/presentation/presentation-state";
import {
  guidedStepDefinition,
  guidedStepFromIncidentStatus,
  nextGuidedTargetAfterAction,
  type GuidedStep
} from "@/lib/ui/guided-workflow";

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type GuidedIncidentView = PresentationIncidentView;
export type GuidedReleasesView = PresentationReleasesView;
export type GuidedValidationView = PresentationValidationView;
export type GuidedAuditView = PresentationAuditView;
export type GuidedDiagnosticLogView = PresentationDiagnosticLogView;
export type GuidedRequestView = PresentationRequestView;
export type GuidedTransactionView = PresentationTransactionView;

interface GuidedWorkflowContextValue {
  runtimeMode: PresentationRuntimeMode;
  incident: GuidedIncidentView | null;
  validation: GuidedValidationView[];
  releases: GuidedReleasesView | null;
  audit: GuidedAuditView[];
  logs: GuidedDiagnosticLogView[];
  requests: GuidedRequestView[];
  transactions: GuidedTransactionView[];
  step: GuidedStep;
  busy: boolean;
  hydrating: boolean;
  error: string | null;
  runPrimaryAction: () => Promise<void>;
  submitRemediationDecision: (action: RemediationAction) => Promise<void>;
  resetDemo: () => Promise<void>;
  refresh: () => Promise<void>;
}

const GuidedWorkflowContext = createContext<GuidedWorkflowContextValue | null>(null);
const RUNTIME_MODE: PresentationRuntimeMode =
  process.env.NEXT_PUBLIC_APPLICATIONOPS_RUNTIME === "server" ? "server" : "presentation";

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Request failed with HTTP ${response.status}.`);
  }
  return payload.data;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function scrollToGuidedTarget(targetId: string) {
  window.setTimeout(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, 80);
}

export function GuidedWorkflowProvider({ children }: { children: ReactNode }) {
  const [presentationState, setPresentationState] = useState(() => createPresentationState());
  const [serverIncident, setServerIncident] = useState<GuidedIncidentView | null>(null);
  const [serverValidation, setServerValidation] = useState<GuidedValidationView[]>([]);
  const [serverReleases, setServerReleases] = useState<GuidedReleasesView | null>(null);
  const [serverAudit, setServerAudit] = useState<GuidedAuditView[]>([]);
  const [serverLogs, setServerLogs] = useState<GuidedDiagnosticLogView[]>([]);
  const [serverRequests, setServerRequests] = useState<GuidedRequestView[]>([]);
  const [serverTransactions, setServerTransactions] = useState<GuidedTransactionView[]>([]);
  const [busy, setBusy] = useState(false);
  const [hydrating, setHydrating] = useState(RUNTIME_MODE === "server");
  const [error, setError] = useState<string | null>(null);

  const incident = RUNTIME_MODE === "presentation" ? presentationState.incident : serverIncident;
  const validation = RUNTIME_MODE === "presentation" ? presentationState.validation : serverValidation;
  const releases = RUNTIME_MODE === "presentation" ? presentationState.releases : serverReleases;
  const audit = RUNTIME_MODE === "presentation" ? presentationState.audit : serverAudit;
  const logs = RUNTIME_MODE === "presentation" ? presentationState.logs : serverLogs;
  const requests = RUNTIME_MODE === "presentation" ? presentationState.requests : serverRequests;
  const transactions = RUNTIME_MODE === "presentation" ? presentationState.transactions : serverTransactions;

  const refresh = useCallback(async () => {
    if (RUNTIME_MODE === "presentation") {
      setError(null);
      return;
    }
    const [nextIncident, nextValidation, nextReleases, nextAudit, nextLogs, nextRequests, nextTransactions] = await Promise.all([
      apiRequest<GuidedIncidentView>(`/api/incidents/${SCENARIO.incidentId}`),
      apiRequest<GuidedValidationView[]>(`/api/incidents/${SCENARIO.incidentId}/validation`),
      apiRequest<GuidedReleasesView>(`/api/incidents/${SCENARIO.incidentId}/releases`),
      apiRequest<GuidedAuditView[]>(`/api/incidents/${SCENARIO.incidentId}/audit`),
      apiRequest<GuidedDiagnosticLogView[]>(`/api/incidents/${SCENARIO.incidentId}/logs`),
      apiRequest<GuidedRequestView[]>(`/api/incidents/${SCENARIO.incidentId}/requests`),
      apiRequest<GuidedTransactionView[]>(`/api/incidents/${SCENARIO.incidentId}/transactions`)
    ]);
    setServerIncident(nextIncident);
    setServerValidation(nextValidation);
    setServerReleases(nextReleases);
    setServerAudit(nextAudit);
    setServerLogs(nextLogs);
    setServerRequests(nextRequests);
    setServerTransactions(nextTransactions);
  }, []);

  useEffect(() => {
    if (RUNTIME_MODE === "presentation") {
      setHydrating(false);
      return;
    }
    let cancelled = false;
    async function hydrate() {
      try {
        await refresh();
        if (!cancelled) setError(null);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load the database-backed demo state.");
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const step = useMemo<GuidedStep>(
    () => guidedStepFromIncidentStatus(incident?.status ?? "OPEN"),
    [incident?.status]
  );

  const runPresentationPrimaryAction = useCallback(async () => {
    switch (step) {
      case 1: {
        const next = presentationStartInvestigation(presentationState);
        setPresentationState(next);
        break;
      }
      case 2: {
        const next = presentationConfirmRegression(presentationState);
        setPresentationState(next);
        break;
      }
      case 3: {
        if (presentationState.incident.status !== "REMEDIATION_SELECTED" || presentationState.incident.selectedRemediation !== "ROLLBACK_RELEASE") {
          scrollToGuidedTarget("remediation");
          return;
        }
        const started = presentationBeginRollback(presentationState);
        setPresentationState(started);
        await wait(420);
        const completed = presentationCompleteRollback(started);
        setPresentationState(completed);
        break;
      }
      case 4: {
        const next = presentationRunValidation(presentationState);
        setPresentationState(next);
        break;
      }
      case 5: {
        const next = presentationResolve(presentationState);
        setPresentationState(next);
        break;
      }
      case 6:
        return;
    }
  }, [presentationState, step]);

  const runPrimaryAction = useCallback(async () => {
    if (busy || hydrating || step === 6) return;
    const definition = guidedStepDefinition(step);
    if (!definition) return;

    setBusy(true);
    setError(null);
    try {
      if (RUNTIME_MODE === "presentation") {
        await runPresentationPrimaryAction();
      } else {
        switch (step) {
          case 1:
            await apiRequest(`/api/incidents/${SCENARIO.incidentId}/investigate`, { method: "POST" });
            break;
          case 2:
            await apiRequest(`/api/incidents/${SCENARIO.incidentId}/confirm-regression`, { method: "POST" });
            break;
          case 3:
            if (incident?.status !== "REMEDIATION_SELECTED" || incident.selectedRemediation !== "ROLLBACK_RELEASE") {
              scrollToGuidedTarget("remediation");
              return;
            }
            await apiRequest(`/api/incidents/${SCENARIO.incidentId}/rollback`, { method: "POST" });
            break;
          case 4:
            await apiRequest(`/api/incidents/${SCENARIO.incidentId}/validation/run`, { method: "POST" });
            break;
          case 5:
            await apiRequest(`/api/incidents/${SCENARIO.incidentId}/resolve`, { method: "POST" });
            break;
        }
        await refresh();
      }
      scrollToGuidedTarget(step === 4 ? "validation" : nextGuidedTargetAfterAction(step));
    } catch (caught) {
      if (RUNTIME_MODE === "server") {
        try {
          await refresh();
        } catch {
          // Preserve the original action error; the next manual refresh can retry state hydration.
        }
      }
      setError(caught instanceof Error ? caught.message : "The guided action failed.");
    } finally {
      setBusy(false);
    }
  }, [busy, hydrating, incident?.status, incident?.selectedRemediation, refresh, runPresentationPrimaryAction, step]);

  const submitRemediationDecision = useCallback(async (action: RemediationAction) => {
    if (busy || hydrating) return;
    setBusy(true);
    setError(null);
    try {
      if (RUNTIME_MODE === "presentation") {
        setPresentationState(presentationRecordRemediation(presentationState, action));
      } else {
        await apiRequest(`/api/incidents/${SCENARIO.incidentId}/remediation`, {
          method: "POST",
          body: JSON.stringify({ action })
        });
        await refresh();
      }
      scrollToGuidedTarget("remediation");
    } catch (caught) {
      if (RUNTIME_MODE === "server") {
        try {
          await refresh();
        } catch {
          // Preserve the decision error as the primary feedback.
        }
      }
      setError(caught instanceof Error ? caught.message : "The remediation decision could not be recorded.");
    } finally {
      setBusy(false);
    }
  }, [busy, hydrating, presentationState, refresh]);

  const resetDemo = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (RUNTIME_MODE === "presentation") {
        setPresentationState(createPresentationState());
      } else {
        await apiRequest(`/api/demo/reset`, { method: "POST" });
        await refresh();
      }
      scrollToGuidedTarget("incident");
    } catch (caught) {
      if (RUNTIME_MODE === "server") {
        try {
          await refresh();
        } catch {
          // Preserve reset failure as the primary feedback.
        }
      }
      setError(caught instanceof Error ? caught.message : "The demo reset failed.");
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  const value = useMemo<GuidedWorkflowContextValue>(
    () => ({
      runtimeMode: RUNTIME_MODE,
      incident,
      validation,
      releases,
      audit,
      logs,
      requests,
      transactions,
      step,
      busy,
      hydrating,
      error,
      runPrimaryAction,
      submitRemediationDecision,
      resetDemo,
      refresh
    }),
    [incident, validation, releases, audit, logs, requests, transactions, step, busy, hydrating, error, runPrimaryAction, submitRemediationDecision, resetDemo, refresh]
  );

  return <GuidedWorkflowContext.Provider value={value}>{children}</GuidedWorkflowContext.Provider>;
}

export function useGuidedWorkflow() {
  const value = useContext(GuidedWorkflowContext);
  if (!value) throw new Error("useGuidedWorkflow must be used inside GuidedWorkflowProvider.");
  return value;
}
