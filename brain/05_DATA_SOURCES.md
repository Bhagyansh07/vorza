# 05 — Data Sources

Status: 🟡 DRAFT

List every external source of data/truth this project depends on. This file
is the inventory; `06_DATA_INGESTION_SPEC.md` describes *how* each source is
pulled in.

## Source Inventory

| # | Source name | Type (API / scrape / manual / file upload / user input) | URL / endpoint | Auth required? | Update frequency | Owner/contact | License / ToS notes |
|---|---|---|---|---|---|---|---|
| 1 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Reliability Notes

For each source, note what happens if it goes down, changes format, or rate
limits you:

- **[Source 1]:** fallback = [ ], alert if stale for > [ ] hours
- **[Source 2]:** fallback = [ ], alert if stale for > [ ] hours

## Legal / Compliance Checklist

- [ ] Confirmed the source's Terms of Service allow this usage (scraping/API reuse/redistribution).
- [ ] Checked `robots.txt` / API rate limits if scraping or polling.
- [ ] Attribution required? If yes, where is it shown in the UI?
- [ ] Any personally identifiable information (PII) involved? If yes, cross-check `10_SECURITY.md`.

## Data Freshness SLA

- Target: data should never be older than [ ] before it's flagged as stale in
  monitoring/alerts.
