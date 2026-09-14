# 04 — Data Model

Status: 🟡 DRAFT

## Entity List

| Entity | Description |
|---|---|
| [ ] | [ ] |
| [ ] | [ ] |

## Entity Details

Repeat this block for each entity/table/collection.

### Entity: [Name]

| Field | Type | Required | Notes |
|---|---|---|---|
| id | UUID/int | yes | primary key |
| [ ] | [ ] | [ ] | [ ] |
| created_at | datetime | yes | |
| updated_at | datetime | yes | |

**Relationships:** [e.g. "has many Orders", "belongs to User"]
**Indexes needed:** [ ]
**Validation rules:** [ ]

## Relationships Diagram (text form)

```
User (1) ----- (many) Order
Order (many) ----- (many) Product
```

## Migration Strategy

- Tool: [e.g. Prisma migrate / Alembic / Flyway / manual SQL]
- Rule: never edit a migration that has already run in production — always add
  a new one.
- Where migrations live: [ ]

## Data Retention & Deletion

- What gets deleted and when: [ ]
- Soft-delete vs hard-delete policy: [ ]
- User data export/deletion process (for privacy compliance): [ ]
