import counties from '../../../shared/map/counties.json';
import population from '../../../shared/map/population.json';
import states from '../../../shared/map/states.json';
import type { MapData } from './mapTypes.ts';

const mapData: MapData = { counties, states, population };
export default mapData;
