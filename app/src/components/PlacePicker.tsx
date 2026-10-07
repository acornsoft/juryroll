import type { County } from '../../../shared/src/counties.ts';
import { STATES } from '../states.ts';
import { UsMap } from './UsMap.tsx';

type PlacePickerProps = {
  stateCode: string;
  countyFips: string;
  counties: County[];
  onState: (code: string) => void;
  onCounty: (fips: string) => void;
};

export function PlacePicker({ stateCode, countyFips, counties, onState, onCounty }: PlacePickerProps) {
  return (
    <div id="placePicker" className="place-layout">
      <UsMap
        stateCode={stateCode}
        countyFips={countyFips}
        counties={counties}
        onState={onState}
        onCounty={onCounty}
      />
      <div className="place-fields">
        <label>
          State
          <select id="stateSel" value={stateCode} onChange={(event) => onState(event.target.value)}>
            <option value="">Choose a state</option>
            {STATES.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
          </select>
        </label>
        <label id="countyPicker">
          County
          <select id="county" value={countyFips} disabled={!stateCode} onChange={(event) => onCounty(event.target.value)}>
            <option value="">Choose a county</option>
            {counties.map((item) => <option key={item.fips} value={item.fips}>{item.name} ({item.fips})</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
