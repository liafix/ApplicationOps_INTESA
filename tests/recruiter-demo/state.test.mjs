import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, runPrimaryAction, validationCount, SCENARIO } from '../../recruiter-demo/state.mjs';

test('full recruiter walkthrough resolves only after evidence-derived validation', () => {
  let state = initialState();
  assert.equal(state.incidentStatus, 'OPEN');
  assert.equal(validationCount(state), 0);

  state = runPrimaryAction(state);
  assert.equal(state.incidentStatus, 'INVESTIGATING');

  state = runPrimaryAction(state);
  assert.equal(state.rootCause, 'RELEASE_TIMEOUT_REGRESSION');

  state = runPrimaryAction(state);
  assert.equal(state.remediation, 'ROLLBACK_RELEASE');

  state = runPrimaryAction(state);
  assert.equal(state.incidentStatus, 'VALIDATED');
  assert.equal(state.activeRelease, SCENARIO.previousRelease);
  assert.equal(state.serviceHealth, 'HEALTHY');
  assert.equal(validationCount(state), 4);

  state = runPrimaryAction(state);
  assert.equal(state.incidentStatus, 'RESOLVED');
  assert.equal(state.complete, true);
  assert.match(state.technicalSummary, /4\/4/);
  assert.ok(state.audit.some((event) => event.type === 'INCIDENT_RESOLVED'));
});

test('reset factory is deterministic', () => {
  assert.deepEqual(initialState(), initialState());
});

test('unsupported out-of-sequence state fails closed', () => {
  const state = initialState();
  state.step = 4;
  assert.throws(() => runPrimaryAction(state), /rollback decision/);
});
