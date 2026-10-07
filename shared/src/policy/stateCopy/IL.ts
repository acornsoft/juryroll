import { EMPTY_STATE_COPY, type StateCopy } from './types.ts';

export const copy: StateCopy = {
  ...EMPTY_STATE_COPY,
  replaceRunningQuestion: true,
  runningQuestion: 'How many reports of legally disqualified drawn jurors did the county clerk receive under 705 ILCS 305/8 in the period? Did any of them lead to a change to the voter list? If so, how many?',
  juryCountLabel: 'Reports of legally disqualified drawn jurors received by the county clerk under 705 ILCS 305/8 (any reason)',
  letterLines: ['The statute sends the names of legally disqualified persons to the county clerk. It does not mention citizenship or voter-list use.'],
};
