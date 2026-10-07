import assert from 'node:assert/strict';
import {
  blockedBranch,
  canActivate,
  clearedSteps,
  emptyFacts,
  railStatus,
  stepById,
  stepOutput,
  type FlowFacts,
} from '../app/src/lib/flow.ts';

function facts(patch: Partial<FlowFacts> = {}): FlowFacts {
  return { ...emptyFacts(), ...patch };
}

const nc = facts({
  stateCode: 'NC',
  stateName: 'North Carolina',
  allowJuryList: true,
  namedExport: true,
});

assert.equal(stepById('where').unlock(emptyFacts()), true);
assert.equal(canActivate(stepById('sign'), emptyFacts()), false);
assert.equal(railStatus(stepById('sign'), emptyFacts(), 'where'), 'locked');
assert.equal(stepById('sign').unlock(nc), true);
assert.equal(stepById('files').unlock(nc), false);

const signed = facts({ ...nc, attested: true });
assert.equal(stepById('files').unlock(signed), true);
assert.equal(stepById('files').blocked(signed), null);
assert.equal(stepById('run').unlock(signed), false);

const loaded = facts({
  ...signed,
  countyName: 'Wake County',
  countyFips: '37183',
  jurorLoaded: true,
  voterLoaded: true,
});
assert.equal(stepById('run').unlock(loaded), true);
assert.equal(stepOutput(stepById('where'), loaded), 'NC · Wake County (37183)');
assert.equal(stepById('triage').unlock(loaded), false);
assert.equal(stepById('export').unlock(loaded), false);

const finished = facts({ ...loaded, hasResult: true });
assert.equal(stepById('triage').unlock(finished), true);
assert.equal(stepById('triage').complete(finished), true);
assert.equal(stepById('export').unlock(finished), true);
assert.equal(stepById('export').unlock(facts({ ...finished, namedExport: false })), false);
assert.equal(stepById('export').unlock(facts({ ...finished, countyFips: '' })), false);

assert.deepEqual(clearedSteps('where', { allowJuryList: true }), ['run', 'triage', 'export']);
assert.deepEqual(clearedSteps('where', { allowJuryList: false }), ['files', 'run', 'triage', 'export']);
assert.deepEqual(clearedSteps('sign', { allowJuryList: true }), ['run', 'triage', 'export']);
assert.deepEqual(clearedSteps('files', { allowJuryList: true }), ['run', 'triage', 'export']);
assert.deepEqual(clearedSteps('run', { allowJuryList: true }), ['triage', 'export']);

const ny = facts({
  stateCode: 'NY',
  stateName: 'New York',
  countyName: 'Kings County',
  countyFips: '36047',
  allowJuryList: false,
  blockReason: 'Judiciary Law 509(a) makes the non-qualified juror records and reasons confidential.',
});
assert.equal(blockedBranch(ny), 'counts-only');
assert.equal(blockedBranch(nc), null);
assert.equal(blockedBranch(emptyFacts()), null);
assert.equal(stepById('files').blocked(ny), ny.blockReason);
assert.equal(canActivate(stepById('files'), ny), true);
assert.equal(stepById('files').unlock(ny), false);
assert.equal(railStatus(stepById('where'), ny, 'sign'), 'done');
assert.equal(railStatus(stepById('sign'), ny, 'sign'), 'active');
assert.equal(railStatus(stepById('files'), ny, 'sign'), 'blocked');
assert.equal(railStatus(stepById('run'), ny, 'sign'), 'locked');
assert.equal(railStatus(stepById('triage'), ny, 'sign'), 'locked');
assert.equal(railStatus(stepById('export'), ny, 'sign'), 'locked');
assert.equal(stepOutput(stepById('where'), ny), 'NY · Kings County (36047)');

console.log('flow tests passed');
