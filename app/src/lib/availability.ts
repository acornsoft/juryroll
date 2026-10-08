import rulesBundle from '../../../shared/src/rulesBundle.json';
import { uiGates, type RulesFile } from '../../../shared/src/policy/gates.ts';

type Bundle = Record<string, { rules?: RulesFile }>;

const bundle = rulesBundle as Bundle;

/** States whose rules allow a jury list. Every other code is coming later. */
const allowed = new Set<string>();
for (const [code, entry] of Object.entries(bundle)) {
  if (entry.rules && uiGates(entry.rules).allow_jury_list === true) allowed.add(code);
}

export function juryListAllowed(code: string): boolean {
  return allowed.has(code);
}
