# Telemetry guide

- Ingest: `POST /api/v1/platform/telemetry/events`
- KPIs: `GET /api/v1/platform/telemetry/metrics`
- Health: `GET /api/v1/platform/observability/health`

Queue snapshots are stored in `QueueHealthSnapshot` for dashboard drill-down.

Configure `SENTRY_DSN_API` for API error tracking.
