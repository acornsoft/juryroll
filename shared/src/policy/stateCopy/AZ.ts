import { EMPTY_STATE_COPY, type StateCopy } from './types.ts';

export const copy: StateCopy = {
  ...EMPTY_STATE_COPY,
  banners: [{ text: 'Pending: RNC v. Mi Familia Vota, No. 25-1017 (argument December 8, 2026). Until the Court decides, the 90-day limit on Arizona cancellations stays in place.' }],
};
