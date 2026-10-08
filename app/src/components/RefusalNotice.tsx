import type { RulesFile } from '../../../shared/src/policy/gates.ts';
import { refusalBlock } from '../../../shared/src/policy/refusal.ts';

export function RefusalNotice({ rules, stateName, today }: { rules: RulesFile; stateName: string; today: string }) {
  const block = refusalBlock(rules, today);
  return (
    <>
      <p className="banner" id="juryRefuse">JuryRoll cannot load the jury list or run a match in {stateName}. The rules say: {rules.gates.basis}</p>
      {block.carryOver && <p id="paCarry">{block.carryOver}</p>}
      {block.lawLine && <p id="refusalLaw">{block.lawLine}</p>}
      {block.publicList && <p id="publicListHint">{block.publicList}</p>}
      {block.useRestriction && <p id="juryUseLimit">{block.useRestriction}</p>}
      {block.extras.map((line) => <p key={line}>{line}</p>)}
      {block.banners.map((line) => <p className="note" key={line}>{line}</p>)}
      {block.noStrong && <p id="noStrongMatch">{block.noStrong}</p>}
    </>
  );
}
