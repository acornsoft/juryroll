export function populationSourceLabel(vintage: number): string {
  return `Approximate. U.S. Census Bureau population estimates, Vintage ${vintage}.`;
}

export function populationSentence(
  countyName: string,
  stateName: string,
  countyPop: number,
  statePop: number,
): string {
  const share = statePop > 0 ? (countyPop / statePop) * 100 : 0;
  const pct = share.toFixed(1);
  const countyText = countyPop.toLocaleString('en-US');
  const stateText = statePop.toLocaleString('en-US');
  return `${countyName}, ${stateName}: population ${countyText} of the state's ${stateText} (${pct}%)`;
}
