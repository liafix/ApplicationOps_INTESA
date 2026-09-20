import { SCENARIO, STEPS, initialState, runPrimaryAction, validationCount } from "./state.mjs";

let state = initialState();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const fmtStatus = (status) => status.replaceAll("_", " ");

function auditMarkup() {
  return [...state.audit]
    .reverse()
    .map(
      (event) => `
    <div class="audit-row">
      <span class="audit-dot"></span>
      <div><strong>${event.type.replaceAll("_", " ")}</strong><small>${event.actor} · ${event.time}</small></div>
    </div>`
    )
    .join("");
}

function stepMarkup() {
  return STEPS.map((step) => {
    const complete = state.step > step.id || state.complete;
    const active = state.step === step.id;
    return `<button class="step ${complete ? "done" : ""} ${active ? "active" : ""}" data-step="${step.id}" ${step.id > Math.min(state.step, 5) ? "disabled" : ""}>
      <span class="step-index">${complete ? "✓" : step.id}</span>
      <span><b>${step.label}</b><small>${step.id === 1 ? "Alert → evidence" : step.id === 2 ? "Release diff → root cause" : step.id === 3 ? "Risk → safe action" : step.id === 4 ? "Rollback → 4/4 gate" : "Handoff → closure"}</small></span>
    </button>`;
  }).join("");
}

function detailMarkup() {
  const current = Math.min(state.step, 5);
  if (state.complete) {
    return `<div class="stage-callout success"><span>Workflow complete</span><h3>Incident resolved with an auditable recovery trail.</h3><p>The demo proves the workflow does not close on intuition: it requires root-cause evidence, an explicit remediation decision, recovery evidence and a separate 4/4 validation gate.</p></div>`;
  }

  if (current === 1) {
    return `<div class="stage-callout info"><span>Checkpoint 1 · Investigate</span><h3>Start from the symptom, then correlate the release and failed request.</h3><p>Release v${SCENARIO.currentRelease} deployed at 07:30. Two minutes later request <code>${SCENARIO.failedRequestId}</code> failed with HTTP 504 / ${SCENARIO.failureCode}.</p></div>`;
  }
  if (current === 2) {
    return `<div class="stage-callout info"><span>Checkpoint 2 · Root cause</span><h3>The failure is consistent with a release timeout regression.</h3><p>Observed downstream latency was <strong>${SCENARIO.observedLatencyMs} ms</strong>. The new release timeout is only <strong>${SCENARIO.currentTimeoutMs} ms</strong>, down from <strong>${SCENARIO.previousTimeoutMs} ms</strong>.</p></div>`;
  }
  if (current === 3) {
    return `<div class="stage-callout warning"><span>Checkpoint 3 · Decision</span><h3>Prefer the reversible action that matches the evidence.</h3><p>Rollback is selected because the previous release is known stable and the regression appears immediately after the timeout change. Riskier production-data changes stay rejected.</p></div>`;
  }
  if (current === 4) {
    return `<div class="stage-callout warning"><span>Checkpoint 4 · Recovery</span><h3>Rollback alone is not enough. Prove the service recovered.</h3><p>The next action restores v${SCENARIO.previousRelease}, records a successful synthetic request/transaction and evaluates all four required recovery checks.</p></div>`;
  }
  return `<div class="stage-callout success"><span>Checkpoint 5 · Closure</span><h3>Validation passed. Create the technical + business handoff, then resolve.</h3><p>Resolution stays a separate explicit action after validation, preserving the boundary between “service appears healthy” and “incident is safe to close.”</p></div>`;
}

function validationMarkup() {
  return state.validation
    .map(
      (check) =>
        `<div class="check-row"><div><b>${check.label}</b><small>${check.key}</small></div><span class="chip ${check.status === "PASS" ? "positive" : ""}">${check.status}</span></div>`
    )
    .join("");
}

function actionLabel() {
  if (state.complete) return "WALKTHROUGH COMPLETE";
  return STEPS.find((step) => step.id === state.step)?.action ?? "CONTINUE";
}

function render() {
  $("#incident-status").textContent = fmtStatus(state.incidentStatus);
  $("#incident-status").className =
    `chip status ${state.incidentStatus === "RESOLVED" || state.incidentStatus === "VALIDATED" ? "positive" : state.incidentStatus === "OPEN" || state.incidentStatus === "ROLLING_BACK" || state.incidentStatus === "READY_FOR_VALIDATION" ? "warning" : "info"}`;
  $("#service-health").textContent = state.serviceHealth;
  $("#service-health").className =
    state.serviceHealth === "HEALTHY" ? "positive-text" : "warning-text";
  $("#active-release").textContent = `v${state.activeRelease}`;
  $("#error-rate").textContent = `${state.errorRate.toFixed(1)}%`;
  $("#error-rate").className =
    state.errorRate < SCENARIO.validationThreshold ? "positive-text" : "danger-text";
  $("#validation-count").textContent = `${validationCount(state)} / 4`;
  $("#root-cause").textContent = state.rootCause ?? "Not confirmed yet";
  $("#remediation").textContent = state.remediation ?? "No decision recorded";
  $("#release-status").textContent = state.currentReleaseStatus;
  $("#steps").innerHTML = stepMarkup();
  $("#stage-detail").innerHTML = detailMarkup();
  $("#validation-list").innerHTML = validationMarkup();
  $("#audit-list").innerHTML = auditMarkup();
  $("#primary-action").textContent = actionLabel();
  $("#primary-action").disabled = state.complete;
  $("#progress-fill").style.width = `${state.complete ? 100 : ((state.step - 1) / 5) * 100}%`;
  $("#progress-copy").textContent = state.complete ? "5 of 5 complete" : `Stage ${state.step} of 5`;
  $("#recovery-evidence").innerHTML = state.recoveryRequest
    ? `
    <div class="evidence-line"><span>Recovery request</span><b>HTTP ${state.recoveryRequest.status} · v${state.recoveryRequest.release}</b></div>
    <div class="evidence-line"><span>Synthetic transaction</span><b>${state.recoveryTransaction.status} · ${state.recoveryTransaction.id}</b></div>`
    : '<p class="muted">Recovery evidence will appear after the rollback stage.</p>';
  $("#handoff").innerHTML = state.technicalSummary
    ? `<div class="handoff-card"><span>Technical handoff</span><p>${state.technicalSummary}</p></div><div class="handoff-card"><span>Business handoff</span><p>${state.businessSummary}</p></div>`
    : '<p class="muted">Closure summaries unlock only after 4/4 validation.</p>';
  bindStepButtons();
}

function bindStepButtons() {
  $$(".step").forEach((button) =>
    button.addEventListener("click", () => {
      const id = Number(button.dataset.step);
      const section = document.querySelector(`[data-section="${id}"]`);
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
}

$("#primary-action").addEventListener("click", () => {
  try {
    state = runPrimaryAction(state);
    render();
  } catch (error) {
    $("#toast").textContent = error instanceof Error ? error.message : "Action blocked.";
    $("#toast").classList.add("show");
    setTimeout(() => $("#toast").classList.remove("show"), 3200);
  }
});

$("#reset-action").addEventListener("click", () => {
  state = initialState();
  render();
});

render();
