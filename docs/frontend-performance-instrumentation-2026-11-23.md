# Frontend real-user timing instrumentation — 2026-11-23

This branch adds **new prospective measurements**, not historical browser timings. Prior baseline available only for Supabase API origin latencies, not full browser page load.

## Metrics collected locally in each browser
- `document_response`: navigation start to final document response byte (includes document network round trip)
- `dom_content_loaded` and `window_load`
- `first_contentful_paint`, `largest_contentful_paint` where supported
- `react_first_mount`: time from module initialization to initial resolved React component mount (does not imply authenticated data complete)
- `authenticated_startup_ready`: navigation-to-startup-completion for authenticated manager experience
- `manager_approval_supabase_confirm`: from starting PATCH/SELECT to confirmed approval row
- `manager_approval_complete`: manager approval callback including dependent audit/Sheet operations (successful callback only)
- A 10% sample of Supabase fetch resource timings by endpoint name (no query strings)

Access local measurements by adding `?perf=1` to a Magnemite URL; the lower-right inspector displays counts, average and p95 and offers CSV export. By design, these browser-local samples do not provide centrally aggregated workforce-wide P95; they do not include personal data, credentials, or raw request URLs. The normal UI remains unchanged.

Vercel Speed Insights browser script is also included for anonymous fleet-wide Core Web Vitals. It requires Speed Insights to be **enabled in Vercel project settings**, and live visits, before results can appear. Not a complete click-to-save telemetry backend.

## Before/after method
Nov 23 production baseline (Supabase origin timing):
- GET time_logs mean 149.4 ms, p95 328.1 ms, max 2325 ms (6318 requests)
- PATCH time_logs mean 127.1 ms, p95 330.6 ms, max 536 ms (180 requests)
- POST time_logs mean 95.9 ms, p95 145.6 ms (10 requests)

After deployment, measure the same API paths in comparable intervals, user load, time zones, and request mix. New browser metrics form the first frontend baseline after installation (there are no historical frontend numbers to compare automatically).

## Release safeguards
No payroll formulas, time-log persistence model, authentication, employee records, or RLS policies were modified. Browser telemetry errors are swallowed and never block operational actions. Do not describe preview READY as authenticated functional UAT.
