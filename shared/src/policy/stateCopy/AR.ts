import { EMPTY_STATE_COPY, type StateCopy } from './types.ts';

export const copy: StateCopy = {
  ...EMPTY_STATE_COPY,
  letterLines: [
    'The Arkansas FOIA covers Arkansas citizens only (Ark. Code 25-19-105(a)(1)(A)); others can use the NVRA request (52 U.S.C. 20507(i)).',
    "The State Board of Election Commissioners' annual Voter Registration Data Audit Report gives the counts.",
  ],
};
