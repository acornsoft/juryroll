import { EMPTY_STATE_COPY, type StateCopy } from './types.ts';

export const copy: StateCopy = {
  ...EMPTY_STATE_COPY,
  pipelineLead: 'Bureau of Elections guidance (March 11, 2026): ',
  letterLines: ['Michigan courts and the county clerk acting as clerk of the circuit court are not covered by FOIA (MCL 15.232(h)(iv)). Ask the Bureau of Elections.'],
};
