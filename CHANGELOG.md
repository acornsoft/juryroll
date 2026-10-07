# Changelog

## 2.0.0 - 2026-10-07

- Field-ready browser app for volunteers. The version 1 matcher and tier rules are unchanged.
- State rules decide whether a jury list can be loaded, whether names can be shown, and whether a referral file can be exported.
- A voter who registered after the jury non-citizen declaration is not a lead. The screen shows N matches excluded: registered after declaration, and N matches cannot compare: no registration date.
- Rules files for all 50 states and the District of Columbia. Connecticut and the District of Columbia are counts only. North Dakota has no registration date to compare.
- The fictional samples include declaration and registration dates, so a North Carolina sample run shows leads, later registrations, and dates that cannot be compared.
- Excel workbooks, blank templates, an audit log, attestation, and a purge step.
- The app does not contact a network. Real voter files stay in the browser.
- The audit log download stays available before a county is chosen. The `.jsonl` header records the county, or "No county selected".
- The footer shows the version and the short git SHA of the build.
