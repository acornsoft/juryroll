import { EMPTY_STATE_COPY, type StateCopy } from './types.ts';

export const copy: StateCopy = {
  ...EMPTY_STATE_COPY,
  replaceRunningQuestion: true,
  runningQuestion: 'How many online applications were checked against the qualified-juror list, and how many could not be verified?',
  suppressJuryCount: true,
  letterLines: ['not evidence of unlawful registration in this jurisdiction'],
};
