/**
 * Health-score thresholds, in one place for the whole frontend.
 *
 *   >= HEALTH_GOOD_MIN  Healthy
 *   >= HEALTH_WARN_MIN  At risk
 *   below               Critical
 *
 * These existed as bare literals in four places and two of them disagreed:
 * the graph bucketed at 70/45 while the dashboard badges bucketed at 80/50, so
 * a file could read "Medium" on the dashboard and "Healthy" in the legend on
 * the same page. One source now, with `features/graph/lib/encoding.ts`
 * re-exporting it so the graph's own tests keep reading it from there.
 *
 * Also documented in `CONTRACTS.md` and `docs/DESIGN_SYSTEM.md`. The backend
 * assertion for the same numbers is `backend/tests/services/
 * test_analysis_scoring.py`.
 */
export const HEALTH_GOOD_MIN = 70;
export const HEALTH_WARN_MIN = 45;
