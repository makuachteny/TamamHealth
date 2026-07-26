# Ministry of Health Experience — Redesign Reference

Status: implemented incrementally starting 2026-07-26. This doc is the source of
truth for the MoH (government role) information architecture, page content,
visualization choices, data model needs, and styling rules.

Research basis: WHO RHIS toolkit, WHO SCORE, WHO Data Quality Assurance
toolkit, WHO EWARS, DHIS2 HMIS / Health Data Toolkit / Data Visualizer, WHO
Data Design Language.

Design stance: a **public health intelligence workspace** — dense but
readable; maps, line lists, scorecards, target-vs-actual, action queues. Not a
hospital dashboard, not a KPI-card SaaS grid. Every visualization states its
**period, geography, denominator (where relevant), and data-quality status**.
No number is ever invented; missing data renders as an explicit empty state.

## 1. Navigation IA (implemented in `src/lib/permissions.ts`, role `government`)

| Section | Item | Route |
|---|---|---|
| National Command | National Dashboard | `/government` |
| | Priority Alerts | `/government/alerts` |
| | Executive Briefing | `/government/briefing` |
| Surveillance & Response | Surveillance | `/surveillance` |
| | Epidemic Intelligence | `/epidemic-intelligence` |
| | Alert Verification | `/epidemic-intelligence?tab=alerts` |
| Health System Performance | Facilities & Services | `/hospitals` |
| | Assessments & Readiness | `/facility-assessments` |
| Programs | Immunization | `/immunizations` |
| | ANC / RMNCAH | `/anc` |
| | MCH Analytics | `/mch-analytics` |
| | Disease Programs (HIV/TB/Malaria placeholders + nutrition status) | `/government/programs` |
| Vital Events & CRVS | Births / Deaths / Vital Statistics | `/births`, `/deaths`, `/vital-statistics` |
| Data Quality | Completeness / Timeliness / Outliers & Validation / Facility Scores | `/data-quality?view=…` |
| Reports & Exchange | Reports & Downloads / DHIS2 Export / Public Statistics | `/reports`, `/dhis2-export`, `/public-stats` |
| Equity & Planning | County Comparison / High Burden–Low Coverage / Service Access Gaps | `/government/equity?view=…` |

Notes:
- "Response Actions" is folded into Priority Alerts (the queue carries response
  links) rather than a separate near-empty page; revisit when a response-log
  data model exists (see §5).
- Query-string deep links are supported: `isHrefAllowed` strips the query
  before matching allowed routes, and target pages sync `?view=`/`?tab=` with
  their internal tabs.
- `/government/*` subroutes are covered by the existing `/government` allow
  entry (prefix matching in `role-routes.ts`).

## 2. National Dashboard (`/government`) — layout

Answers: *what is happening nationally, where is action needed, can we trust
the data?* Single screen; details live in module pages.

1. **Header** — "National situation · South Sudan · <month>" + Executive
   Briefing / Priority Alerts buttons. No hero.
2. **Situation strip** — one connected 8-slot strip (not a card grid):
   reporting completeness, timeliness, active alerts, outbreak risk (derived
   strictly from worst active alert level), fully-immunized %, ANC4+ %, birth
   certificate %, death certificate %. Each slot: value, threshold tone,
   denominator/period subline.
3. **National map** (3/5 width) — 10-state **tile-grid cartogram** with layer
   switcher: Alert cases (red intensity), Reporting completeness (traffic-light
   thresholds), Immunization records (green intensity), Facilities (deep-blue
   intensity). Tile click = state drill-down strip (facilities, alert cases,
   records, completeness) with a jump to the facility registry. A tile grid is
   deliberate: honest, legible, no fake polygon precision; swap for GeoJSON
   choropleth when boundary files are added (§5).
4. **Priority watchlist** (2/5 width) — ranked action queue merging emergency
   and warning alerts, facilities <80% completeness, and immunization
   defaulters; severity dot + metric + deep link. Empty state says so.
5. **Trends panel** — weekly reported cases (last 12 ISO weeks, all diseases)
   + births-vs-deaths per month (last 6).
6. **Programme coverage panel** — target-vs-actual bullet bars (fully
   immunized/90, ANC4+/80, birth cert/90, death cert/90) with explicit
   recorded-data denominators.
7. **Data quality panel** — warning line list (facilities under 80%
   completeness/timeliness, latest assessment date).
8. **Reports & exchange panel** — DHIS2 configured/host, last sync vs attempt,
   last dataset period + value count, recent log lines, facilities-reporting
   ratio.

## 3. Module pages (content) & 4. best visualization per module

- **Priority Alerts** (`/government/alerts`): ranked line list (level → cases),
  columns disease/location/cases/deaths/level pill/trend/reported, search;
  top-3 counties response note. *Viz: line list — action queues are tables.*
- **Executive Briefing** (`/government/briefing`): print-friendly narrative —
  situation, service delivery, vital events, data quality, recommended
  actions; every line computed from services. *Viz: factual bullets, no
  charts; it is read aloud in review meetings.*
- **Surveillance** (existing `/surveillance`): alert queue, epidemic curves,
  threshold breaches. *Viz: epidemic curve (weekly bars/line), line list.*
- **Epidemic Intelligence** (existing, now URL-tabbed): signals, verification
  (EWARS alerts tab), Rt, geographic spread. *Viz: epi curve, map/table, event
  timeline.*
- **Facilities & Services** (`/hospitals`) + **Assessments & Readiness**
  (`/facility-assessments`): registry, SARA-style readiness and service
  availability from assessments. *Viz: facility scorecard table + map.*
- **Programs**: immunization coverage & dropout (`/immunizations` cascade),
  ANC cascade ANC1→ANC5+ (`/anc`, `/mch-analytics`), Disease Programs page
  with honest HIV/TB/Malaria placeholders (malaria shows surveillance signal,
  labeled as such). *Viz: funnel/cascade + target-vs-actual bullets.*
- **CRVS**: births/deaths registries + vital statistics; certificate-issuance
  completeness as the registration-completeness proxy until a population
  denominator exists. *Viz: monthly time series + completeness bullets.*
- **Data Quality** (`/data-quality?view=…`): completeness, timeliness,
  facility scores (ranked tables with threshold coloring, mini-bars), outliers
  (>3× median cases per disease flagged "verify at source"), validation-rules
  placeholder until a rules engine exists. *Viz: ranked scorecard tables +
  outlier table; heatmap (facility×month) once monthly report docs exist (§5).*
- **Reports & Exchange**: DHIS2 export status + failed queue (sync log),
  downloadable reports, public stats publication. *Viz: status line list.*
- **Equity & Planning** (`/government/equity?view=…`): county comparison
  (ranked inline-bar table), burden-vs-visibility scatter with median
  quadrants (priority = high burden / low completeness), facility-density
  access gaps. *Viz: quadrant scatter + ranked bars; explicitly caption that
  completeness is a visibility proxy, not coverage.*

## 5. Data model needs (to remove today's proxies)

Current gaps and the doc types that would close them:

1. **`monthly_report`** `{ facilityId, period(YYYY-MM), dataset, submittedAt,
   dueAt }` → real completeness/timeliness per facility-month, and the
   facility×month heatmap. Today both come from facility-assessment scores.
2. **Population denominators** `{ geography, year, population, liveBirths,
   under1, under5, expectedPregnancies }` (per state/county) → true coverage
   rates; today all rates use recorded-data denominators (and say so).
3. **`response_action`** `{ alertId, action, status, owner, dueDate }` →
   a real Response Actions module + closure status on epidemic events.
4. **Validation rules** `{ rule, expression, severity }` + evaluation results
   → Data Quality "Validation" view.
5. **GeoJSON boundaries** for states/counties → replace the tile grid with a
   real choropleth (keep the tile grid as the fallback).
6. **Programme datasets** for HIV/TB/Malaria (cases on treatment, TSR,
   test-positivity) → replace the placeholder cards.
7. **Cause-of-death coding** (ICD-11 grouping on `death` docs — partial today)
   → CRVS cause-of-death panel and MPDSR review flags.

## 6. React/Next.js implementation notes

- All MoH pages are client components over local PouchDB hooks/services —
  same offline-first pattern as the rest of the platform. Aggregations happen
  in `useMemo` from `useSurveillance`, `useHospitals`, `useBirths`,
  `useDeaths`, and async service calls (`getNationalDataQuality`,
  `getImmunizationStats`, `getANCStats`, `getDhis2SyncLog`) in one
  `Promise.all` effect with cancellation.
- Tab-carrying pages read `useSearchParams` and write back with
  `router.replace(..., { scroll: false })` so nav deep-links and back/forward
  both work.
- Recharts only (already bundled): LineChart, ScatterChart, bullet bars are
  plain divs. `initialDimension` workaround only needed inside flex parents.
- New pages live under `src/app/(dashboard)/government/*` so the existing
  `/government` route allowance covers them; no proxy/edge changes.

## 7. Styling rules (charts, maps, tables, scorecards, queues)

- Palette: blue `#2a78d6` (system/primary series), red `#e34948` (alerts),
  green `#199e70` (readiness/target met), amber `#eda100` (warning band),
  deep blue `#015697` (secondary series), neutral greys from tokens. Never
  more than 3 series per chart.
- Thresholds (WHO DQR-style): `<60` red, `60–79` amber, `≥80` green for
  completeness/timeliness; programme targets marked with a tick on bullet
  bars (immunization 90, ANC4+ 80, certificates 90).
- Charts: `CartesianGrid` dashed, vertical lines off; axes via shared
  `axisTick`; tooltips via shared `tooltipStyle`; no animation on
  situation-critical charts (`isAnimationActive={false}`).
- Tables: 11px bold uppercase muted headers, 13px muted cells, 14/800 primary
  names — identical to the patients-list scale so the whole app scans the
  same. Mini-bars are 8px rounded divs, not chart components.
- Maps: tile-grid cartogram, value + 3-letter state code per tile; intensity
  ramps by color-mix on white; completeness layer uses threshold colors, not
  intensity. Selected tile gets a 2px deep-blue outline.
- Action queues: severity dot → title (14/800) → one-line detail (11 muted) →
  right-aligned metric in the severity color → chevron; entire row is the
  click target.
- Gauges: avoided; the only "single national number" treatment is the
  situation strip. Factoids restricted to that strip.
