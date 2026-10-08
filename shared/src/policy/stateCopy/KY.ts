import { EMPTY_STATE_COPY, type StateCopy } from './types.ts';

export const copy: StateCopy = {
  ...EMPTY_STATE_COPY,
  letterLines: [
    'How many protests were filed and how many voters were restored?',
    'Only Kentucky residents may use the Open Records Act (KRS 61.872(1)).',
  ],
};
