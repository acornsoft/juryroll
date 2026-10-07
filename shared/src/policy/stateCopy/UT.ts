import { EMPTY_STATE_COPY, type StateCopy } from './types.ts';

export const copy: StateCopy = {
  ...EMPTY_STATE_COPY,
  replaceRunningQuestion: true,
  runningQuestion: 'Is an agreement under Utah Code 20A-2-502(4) in force?',
};
