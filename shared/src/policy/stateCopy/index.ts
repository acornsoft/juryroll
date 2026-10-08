import { EMPTY_STATE_COPY, type StateCopy } from './types.ts';
import { copy as NY } from './NY.ts';
import { copy as NC } from './NC.ts';
import { copy as GA } from './GA.ts';
import { copy as TX } from './TX.ts';
import { copy as PA } from './PA.ts';
import { copy as AZ } from './AZ.ts';
import { copy as FL } from './FL.ts';
import { copy as MI } from './MI.ts';
import { copy as WI } from './WI.ts';
import { copy as VA } from './VA.ts';
import { copy as OH } from './OH.ts';
import { copy as IN } from './IN.ts';
import { copy as IA } from './IA.ts';
import { copy as KS } from './KS.ts';
import { copy as KY } from './KY.ts';
import { copy as LA } from './LA.ts';
import { copy as TN } from './TN.ts';
import { copy as AR } from './AR.ts';
import { copy as CT } from './CT.ts';
import { copy as OK } from './OK.ts';
import { copy as SD } from './SD.ts';
import { copy as UT } from './UT.ts';
import { copy as CO } from './CO.ts';
import { copy as ID } from './ID.ts';
import { copy as MT } from './MT.ts';
import { copy as NE } from './NE.ts';
import { copy as NH } from './NH.ts';
import { copy as WA } from './WA.ts';
import { copy as WV } from './WV.ts';
import { copy as AL } from './AL.ts';
import { copy as DE } from './DE.ts';
import { copy as MA } from './MA.ts';
import { copy as NJ } from './NJ.ts';
import { copy as NM } from './NM.ts';
import { copy as RI } from './RI.ts';
import { copy as VT } from './VT.ts';
import { copy as WY } from './WY.ts';
import { copy as AK } from './AK.ts';
import { copy as CA } from './CA.ts';
import { copy as DC } from './DC.ts';
import { copy as HI } from './HI.ts';
import { copy as IL } from './IL.ts';
import { copy as ME } from './ME.ts';
import { copy as MD } from './MD.ts';
import { copy as MN } from './MN.ts';
import { copy as MS } from './MS.ts';
import { copy as MO } from './MO.ts';
import { copy as NV } from './NV.ts';
import { copy as ND } from './ND.ts';
import { copy as OR } from './OR.ts';
import { copy as SC } from './SC.ts';

export const STATE_COPY: Record<string, StateCopy> = {
  NY,
  NC,
  GA,
  TX,
  PA,
  AZ,
  FL,
  MI,
  WI,
  VA,
  OH,
  IN,
  IA,
  KS,
  KY,
  LA,
  TN,
  AR,
  CT,
  OK,
  SD,
  UT,
  CO,
  ID,
  MT,
  NE,
  NH,
  WA,
  WV,
  AL,
  DE,
  MA,
  NJ,
  NM,
  RI,
  VT,
  WY,
  AK,
  CA,
  DC,
  HI,
  IL,
  ME,
  MD,
  MN,
  MS,
  MO,
  NV,
  ND,
  OR,
  SC,
};

export function stateCopy(code: string): StateCopy {
  return STATE_COPY[code] ?? EMPTY_STATE_COPY;
}
