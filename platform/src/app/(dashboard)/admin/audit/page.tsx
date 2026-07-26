'use client';

/**
 * Super-admin → Audit Logs.
 * Filterable, paginated view over the real audit_log store, with a
 * client-side CSV export of whatever is currently filtered (for evidence
 * requests / compliance reviews).
 */
import { useEffect, useMemo, useState } from 'react';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import type { AuditLogDoc } from '@/lib/db-types';
import {
  SaPage, SaCard, SaStat, SaPill, SaTable,
  classifyAuditRisk, SEVERITY_TONE, formatWhen,
  type SaSeverity,
} from '@/components/admin/sa-ui';

type RangeFilter = '24h' | '7d' | '30d' | 'all';
type SuccessFilter = 'all' | 'success' | 'failure';
type RiskFilter = 'all' | SaSeverity;

const PAGE_SIZE = 50;
const SEVERITIES: SaSeverity[] = ['critical', 'high', 'medium', 'low'];

const RANGE_MS: Record<Exclude<RangeFilter, 'all'>, number> = {
  '24h': 24 * 3600 * 1000,
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
};

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export default function AuditLogsPage() {
  const { organizations } = useOrganizations();
  const [logs, setLogs] = useState<AuditLogDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [range, setRange] = useState<RangeFilter>('7d');
  const [successFilter, setSuccessFilter] = useState<SuccessFilter>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [orgFilter, setOrgFilter] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { getRecentAuditLogs } = await import('@/lib/services/audit-service');
        const data = await getRecentAuditLogs(1000);
        if (mounted) setLogs(data);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const orgNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const org of organizations) m.set(org._id, org.name);
    return m;
  }, [organizations]);

  const withRisk = useMemo(
    () => logs.map(log => ({ log, risk: classifyAuditRisk(log.action, log.success) })),
    [logs]
  );

  const inRange = useMemo(() => {
    if (range === 'all') return withRisk;
    const cutoff = Date.now() - RANGE_MS[range];
    return withRisk.filter(({ log }) => {
      const t = log.createdAt ? new Date(log.createdAt).getTime() : 0;
      return t >= cutoff;
    });
  }, [withRisk, range]);

  const stats = useMemo(() => {
    const failures = inRange.filter(({ log }) => !log.success).length;
    const highRisk = inRange.filter(({ risk }) => risk === 'critical' || risk === 'high').length;
    const users = new Set(inRange.map(({ log }) => log.userId || log.username || 'unknown'));
    return { events: inRange.length, failures, highRisk, users: users.size };
  }, [inRange]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inRange.filter(({ log, risk }) => {
      if (successFilter === 'success' && !log.success) return false;
      if (successFilter === 'failure' && log.success) return false;
      if (riskFilter !== 'all' && risk !== riskFilter) return false;
      if (orgFilter !== 'all' && log.orgId !== orgFilter) return false;
      if (q) {
        const haystack = `${log.action} ${log.username || ''} ${log.details || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [inRange, successFilter, riskFilter, orgFilter, search]);

  // Filters changed underneath the current page — snap back to page 1 rather
  // than showing an empty page past the new result count.
  useEffect(() => { setPage(0); }, [successFilter, riskFilter, orgFilter, search, range]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    const header = ['timestamp', 'user', 'org', 'action', 'details', 'success', 'risk'];
    const lines = [header.join(',')];
    for (const { log, risk } of filtered) {
      lines.push([
        csvCell(log.createdAt || ''),
        csvCell(log.username || log.userId || ''),
        csvCell(orgNameById.get(log.orgId || '') || log.orgId || ''),
        csvCell(log.action),
        csvCell(log.details || ''),
        csvCell(String(log.success)),
        csvCell(risk),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-evidence-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <SaPage title="Audit Logs" subtitle="Every recorded platform action, filterable and exportable for compliance evidence.">
      <div className="sa-stat-strip">
        <SaStat label="Events in range" value={stats.events} />
        <SaStat label="Failures" value={stats.failures} tone={stats.failures ? 'danger' : 'muted'} />
        <SaStat label="High-risk actions" value={stats.highRisk} tone={stats.highRisk ? 'warn' : 'muted'} />
        <SaStat label="Distinct users" value={stats.users} />
      </div>

      <SaCard
        title="Audit trail"
        meta={`Page ${page + 1} of ${pageCount} · ${filtered.length} events`}
        actions={
          <>
            <button type="button" className="sa-btn" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</button>
            <button type="button" className="sa-btn" disabled={page >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>Next</button>
            <button type="button" className="sa-btn primary" onClick={exportCsv}>Export evidence (CSV)</button>
          </>
        }
      >
        <div className="sa-filter-bar">
          <input
            type="search"
            placeholder="Search action, user, or details…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={successFilter} onChange={e => setSuccessFilter(e.target.value as SuccessFilter)}>
            <option value="all">All results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
          <select value={riskFilter} onChange={e => setRiskFilter(e.target.value as RiskFilter)}>
            <option value="all">All risk</option>
            {SEVERITIES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)}>
            <option value="all">All organizations</option>
            {organizations.map(org => <option key={org._id} value={org._id}>{org.name}</option>)}
          </select>
          <select value={range} onChange={e => setRange(e.target.value as RangeFilter)}>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        <SaTable
          columns={['When', 'User', 'Org', 'Action', 'Detail', 'Result', 'Risk']}
          empty={loading ? 'Loading audit logs…' : 'No audit events match these filters.'}
        >
          {pageRows.map(({ log, risk }) => (
            <tr key={log._id}>
              <td>{formatWhen(log.createdAt)}</td>
              <td><strong>{log.username || log.userId || 'System'}</strong></td>
              <td>{orgNameById.get(log.orgId || '') || (log.orgId ? log.orgId : '—')}</td>
              <td>{log.action}</td>
              <td>{log.details || '—'}</td>
              <td>{log.success ? <SaPill tone="ok">Success</SaPill> : <SaPill tone="danger">Failure</SaPill>}</td>
              <td><SaPill tone={SEVERITY_TONE[risk]}>{risk.toUpperCase()}</SaPill></td>
            </tr>
          ))}
        </SaTable>
      </SaCard>
    </SaPage>
  );
}
