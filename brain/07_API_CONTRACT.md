# 07 — API Contract

Status: 🟡 DRAFT

## Conventions

- Base URL: [ ]
- Format: JSON (unless noted)
- Auth: [Bearer token / API key / session cookie] — see `10_SECURITY.md`
- Versioning: [e.g. `/v1/...`, header-based, etc.]
- Standard error shape:

```json
{
  "error": {
    "code": "string",
    "message": "human readable message",
    "details": {}
  }
}
```

## Endpoints

Repeat this block per endpoint.

### `GET /v1/[resource]`

- **Description:** [ ]
- **Auth required:** [yes/no]
- **Query params:** `page`, `limit`, `[custom_filter]`
- **Success response (200):**
```json
{
  "data": [ { "id": "string", "field": "value" } ],
  "meta": { "page": 1, "total": 100 }
}
```
- **Error responses:** `400` invalid params, `401` unauthenticated, `404` not found

### `POST /v1/[resource]`

- **Description:** [ ]
- **Auth required:** [yes/no]
- **Request body:**
```json
{ "field": "value" }
```
- **Success response (201):**
```json
{ "data": { "id": "string" } }
```
- **Error responses:** `400`, `401`, `409` (conflict), `422` (validation)

## Rate Limiting

- Limit: [e.g. 100 requests / minute / IP or API key]
- Response when exceeded: `429 Too Many Requests` with `Retry-After` header

## Pagination Standard

- Style: [offset/limit or cursor-based]
- Default page size: [ ], max page size: [ ]
