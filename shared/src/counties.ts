// County and county-equivalent names with 5-digit FIPS codes.
// Source: U.S. Census Bureau, 2025 Gazetteer Files, National Counties Gazetteer
// File (2025_Gaz_counties_national.txt, dated 2025-09-08). Public domain
// (17 U.S.C. 105). The geography matches the 2025 American Community Survey.
// https://www.census.gov/geographies/reference-files/2025/geo/gazetter-file.html
// The verbatim source file is shared/data/2025_Gaz_counties_national.txt.
// Puerto Rico is in that file and is not listed here. Louisiana entries are
// parishes. Alaska entries are boroughs, municipalities, and census areas.
// Virginia entries include independent cities. The District of Columbia is
// one entry. Connecticut entries are the nine planning regions the Census
// Bureau uses as county equivalents.

import data from './counties.json';

export type County = { fips: string; name: string };

export const COUNTY_SOURCE = {
  agency: 'U.S. Census Bureau',
  title: '2025 Gazetteer Files, National Counties Gazetteer File',
  vintage: '2025',
  fileDate: '2025-09-08',
  file: '2025_Gaz_counties_national.txt',
  url: 'https://www.census.gov/geographies/reference-files/2025/geo/gazetter-file.html',
} as const;

export const COUNTIES: Record<string, County[]> = data;
