# UI Style Guide — the "nurse / clinical-officer" standard

Every sidebar page should look like the nurse dashboard: a consistent header, clean
card sections with icon headers, tidy KPI tiles, pill chips, and even spacing. The
look is built almost entirely from existing shared classes/components — use them,
don't invent new ones. **Presentation only: never change data fetching, handlers,
routes, or business logic.**

## 1. Page wrapper
```tsx
<TopBar title="…" />
<main className="page-container page-enter"> … </main>
```

## 2. Page header — always the shared component
Replace any ad-hoc `<h1>`/custom header block with:
```tsx
<PageHeader
  icon={SomeLucideIcon}
  title="Page Title"
  subtitle="One short line of context"
  stats={[{ label: 'PENDING', value: 12 }, …]}   // optional inline KPIs
  actions={<button className="btn btn-primary">…</button>}  // optional
/>
```
Pick a relevant icon from `@/components/icons/lucide`. Keep titles short.

## 3. KPI tiles (when a page leads with numbers)
A row of tiles, mirroring FacilityAdminDashboard:
```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
  <button className="dash-card text-left" style={{ padding: '14px 16px' }}>
    <div className="flex items-center gap-2 mb-2">
      <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
      </div>
      <span className="kpi-card-title">Label</span>
    </div>
    <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800 }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>sub-label</div>
  </button>
  …
</div>
```
Or fold the numbers into `PageHeader stats` instead — pick one, not both.

## 4. Content sections — `dash-card` with an icon header
```tsx
<div className="dash-card overflow-hidden">
  <div className="flex items-center justify-between p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Section title</h3>
    </div>
    {/* optional right link */}
    <button className="text-[11px] font-semibold inline-flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>View all <ChevronRight className="w-3 h-3" /></button>
  </div>
  <div className="p-4"> … body … </div>
</div>
```
For tables, set the card body padding to `0`, keep the header row above, and use a
sticky `thead` with `text-[10px] font-semibold uppercase tracking-wider` muted cells
on `var(--bg-card-solid)`.

## 5. Chips / pills (e.g. role counts on HR "Active Roster")
Never bare text. Use pills:
```tsx
<span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
  style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
  Label · 3
</span>
```
Render them in a `flex flex-wrap gap-2`.

## 6. Tabs (e.g. Staff Roster / Leave / Shift / Payroll)
Use the shared `FilterTabs` from `@/components/filters` when present, or pill tab
buttons styled like it (active = accent fill, inactive = subtle bg + border).

## 7. Empty states
Centered in the card: muted icon + one muted line.
```tsx
<div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
  <Icon className="w-8 h-8 mx-auto mb-2" style={{ opacity: 0.6 }} /> No items yet.
</div>
```

## 8. Spacing & tokens
- Major blocks: `gap-4` / `mb-4`. Tile rows + chips: `gap-2.5` / `gap-2`.
- Colors: only theme tokens `var(--…)` (and the existing accent palette already in use). No new hex.

## Rules
- Reuse: `PageHeader`, `FilterBar`/`FilterTabs`/`SearchInput`, `Modal`, `PatientName`, `dash-card`, `card-elevated`, `icon-box-sm`, `kpi-card-title`, `stat-value`, `data-row`.
- If a page already cleanly uses `PageHeader` + `dash-card`/`card-elevated` and looks consistent, leave it — don't churn.
- No new dependencies, no logic changes, keep all functionality. Verify with eslint (0 errors) on touched files.
