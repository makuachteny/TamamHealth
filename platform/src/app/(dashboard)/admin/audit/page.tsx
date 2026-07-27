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
import EhrListHeader, { EhrListFilters, LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';
import { FilterSelect } from '@/components/filters';
import {
  SaPage, SaCard, SaPill, SaTable,
  classifyAuditRisk, SEVERITY_TONE, formatWhen,
  type SaSeverity,
} from '@/components/admin/sa-ui';

type RangeFilter = '24h' | '7d' | '30d' | 'all';
type SuccessFilter = 'all' | 'success' | 'failure';
type RiskFilter = 'all' | SaSeverity;

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

  const activeFilterCount =
    (successFilter !== 'all' ? 1 : 0) +
    (riskFilter !== 'all' ? 1 : 0) +
    (orgFilter !== 'all' ? 1 : 0) +
    (range !== '7d' ? 1 : 0);

  return (
    <SaPage>
      <SaCard>
        <EhrListHeader
          title="Audit Logs"
          stats={[
            { label: 'Showing', value: `${filtered.length} of ${inRange.length}`, color: LIST_STAT_COLORS.muted },
            { label: 'Failures', value: stats.failures, color: stats.failures ? 'var(--color-danger)' : LIST_STAT_COLORS.muted },
            { label: 'High-risk actions', value: stats.highRisk, color: stats.highRisk ? 'var(--color-danger)' : LIST_STAT_COLORS.amber },
            { label: 'Distinct users', value: stats.users, color: LIST_STAT_COLORS.muted },
          ]}
          search={{ value: search, onChange: setSearch, placeholder: 'Search action, user, or details…', ariaLabel: 'Search audit log' }}
          actions={
            <>
              <EhrListFilters activeCount={activeFilterCount} onClear={() => { setSuccessFilter('all'); setRiskFilter('all'); setOrgFilter('all'); setRange('7d'); }}>
                <FilterSelect
                  label="Result"
                  value={successFilter}
                  onChange={value => setSuccessFilter(value as SuccessFilter)}
                  neutralValue="all"
                  size="sm"
                  options={[{ value: 'all', label: 'All results' }, { value: 'success', label: 'Success' }, { value: 'failure', label: 'Failure' }]}
                />
                <FilterSelect
                  label="Risk"
                  value={riskFilter}
                  onChange={value => setRiskFilter(value as RiskFilter)}
                  neutralValue="all"
                  size="sm"
                  options={[{ value: 'all', label: 'All risk' }, ...SEVERITIES.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))]}
                />
                <FilterSelect
                  label="Organization"
                  value={orgFilter}
                  onChange={setOrgFilter}
                  neutralValue="all"
                  size="sm"
                  options={[{ value: 'all', label: 'All organizations' }, ...organizations.map(org => ({ value: org._id, label: org.name }))]}
                />
                <FilterSelect
                  label="Date range"
                  value={range}
                  onChange={value => setRange(value as RangeFilter)}
                  neutralValue="7d"
                  size="sm"
                  options={[
                    { value: '24h', label: 'Last 24h' },
                    { value: '7d', label: 'Last 7 days' },
                    { value: '30d', label: 'Last 30 days' },
                    { value: 'all', label: 'All time' },
                  ]}
                />
              </EhrListFilters>
              <button type="button" className="sa-btn primary" onClick={exportCsv}>Export evidence (CSV)</button>
            </>
          }
        />
        {/* No pager: every matching event lives in one scroll area, and the
            header's "Showing X of Y" chip states the count. */}
        <div style={{ maxHeight: 620, overflowY: 'auto' }}>
        <SaTable
          columns={['When', 'User', 'Org', 'Action', 'Detail', 'Result', 'Risk']}
          empty={loading ? 'Loading audit logs…' : 'No audit events match these filters.'}
        >
          {filtered.map(({ log, risk }) => (
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
        </div>
      </SaCard>
    </SaPage>
  );
}
