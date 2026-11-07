# Engineering QA Report

**Scope:** Consolidated application under `frontend/`  
**Execution principle:** Only mark checks that were run as PASS.  
**Production data:** No production database was accessed or modified.

## Verification summary

| Area | Test scenario | Expected result | Actual result | Status |
|---|---|---|---|---|
| Production build | Run `npm run build` in `frontend/` after the dependency and route-splitting changes | Vite creates a production build with page chunks | `npm run build` completed successfully; pages are split, Reports is 8.62 kB, and ExcelJS is a separate 940.19 kB lazy-loaded chunk (Vite reports a large-chunk warning) | PASS |
| Package installation | Run `npm install` in `frontend/` | Unified lockfile/dependencies install | Final `npm ls --depth=0` completed successfully; all declared top-level dependencies are present | PASS |
| API health | Start Express app with no database request and call `/health` | HTTP 200 with API health response | HTTP 200; response reported status `OK` | PASS |
| Registration authorization | Attempt registration without a token and with a staff JWT | Both requests rejected before database access | Missing token returned HTTP 401; staff token returned HTTP 403 | PASS |
| Production authorization | Try production creation/status mutation with a staff JWT | Both rejected before database access | Both returned HTTP 403 | PASS |
| Protected orders | Call orders with no token and an invalid JWT | Reject unauthorized requests | HTTP 401 for missing and invalid tokens | PASS |
| Login abuse control | Submit repeated invalid login requests from one client | Return 429 after the configured threshold | The 11th attempt returned HTTP 429 after ten permitted requests | PASS |
| Administrator login/JWT issuance | Authenticate an administrator against isolated MongoDB and validate token expiry | Valid JWT issued and accepted; expired JWT rejected | Requires isolated MongoDB and administrator test account, neither is available here | NOT TESTED |
| Orders workflow | Create, retrieve, update status, refresh, and verify persisted test order | Record persists and status is consistent after refresh | No isolated MongoDB service is reachable; no order was created | NOT TESTED |
| Cashier synchronization | Observe new orders/status changes without manual refresh, including API interruption | Orders refresh periodically and on window focus | Orders now refetch every 30 seconds and on focus; end-to-end behavior requires a database-backed session | NOT TESTED |
| Ingredients/categories/products/recipes/production/stock/reports | Execute representative create/read/update/delete and report scenarios | Each operation enforces validation and persists correctly | Requires isolated MongoDB; not exercised | NOT TESTED |
| Vercel deployment | Deploy and test API/database against Vercel | Live deployment and persistent Atlas integration work | Deployment credentials/access were not provided; no deployment attempted | REQUIRES CLIENT ACTION |

## Security authorization smoke tests

Isolated Node tests run with `npm test`, using test-only JWTs and an ephemeral HTTP port. They do not connect to MongoDB or use any configured environment-file credentials.

Final isolated test run:

- 7 tests passed
- 0 failed

No test failures. Build output retains Vite's advisory about the separately loaded 940.19 kB ExcelJS chunk; the Reports route itself is 8.62 kB and the spreadsheet library is only requested when exporting.

## Database isolation

No local MongoDB listener was reachable on `127.0.0.1:27017`. The configured environment file was not used for tests because its target could be a real database. Database persistence, administrator login, and business CRUD workflows are therefore explicitly **NOT TESTED**, not assumed to work.

## Dependency audit

The initial audit reported 20 vulnerabilities (1 low, 7 moderate, 12 high). Vite was explicitly upgraded to the patched 6.x line, the unmaintained/high-severity `xlsx` dependency was removed in favor of ExcelJS, and `npm audit fix` applied compatible dependency updates without `--force`. The latest audit reports 13 moderate, 0 high, 0 critical, and 0 low vulnerabilities. Remaining advisories are transitive dependencies in ExcelJS, React Query v3, and React Router v6; npm proposes major/downgrade changes, so no forced version changes were made.

## Deployment status

**CODE READY FOR DEPLOYMENT CHECKS — NOT DEPLOYED OR VERIFIED.**

Vercel's Root Directory should be `frontend`. The client must configure MongoDB Atlas, Vercel environment variables, and ownership/access before a live deployment can be tested.
