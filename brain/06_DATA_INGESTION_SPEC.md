# 06 — Data Ingestion / Scraping Spec

Status: 🟡 DRAFT — only relevant if this project pulls data from scraping,
polling third-party APIs, or scheduled imports. Delete this file if not
applicable, but note that decision in `17_DECISIONS.md`.

## Per-Source Ingestion Plan

Repeat for each source from `05_DATA_SOURCES.md` that needs active ingestion.

### Source: [Name]

- **Method:** [HTTP scrape with selectors / official API polling / RSS / webhook / CSV drop]
- **Target URL(s) / endpoint(s):** [ ]
- **Selectors / field mapping:** [e.g. CSS selector `.result-title` → `title` field]
- **Schedule:** [cron expression or plain description, e.g. "every 30 min"]
- **Pagination handling:** [ ]
- **Rate limiting / politeness:** [requests per minute cap, delay between requests, custom User-Agent]
- **Deduplication key:** [which field(s) determine a duplicate record]
- **Change detection:** [how do we know a record was updated vs newly created?]
- **Retry policy:** [max retries, backoff strategy — see `09_ERROR_HANDLING.md`]
- **Failure alerting:** [who/what gets notified if this source fails N times in a row]

## Compliance Guardrails

- [ ] Respect `robots.txt` and documented rate limits.
- [ ] Do not scrape data behind a login/paywall without explicit authorization.
- [ ] Do not store more personal data than necessary.
- [ ] Cache/store raw source snapshots for [ ] days for debugging/audit.

## Data Validation on Ingest

- Required fields check: [ ]
- Type/format validation: [ ]
- What happens to a record that fails validation: [drop / quarantine table / alert]

## Storage of Ingested Data

- Raw layer: [ ] (unmodified source data, for reprocessing)
- Normalized/clean layer: [ ] (what the app actually reads, matches `04_DATA_MODEL.md`)
