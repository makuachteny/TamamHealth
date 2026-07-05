'use client';

import { useState } from 'react';
import TopBar from '@/components/TopBar';
import {
  RefreshCw, CheckCircle, Clock, AlertTriangle,
  Download, FileJson, FileSpreadsheet, Upload, Loader2,
  Wifi, Database, FileText, BarChart3,
} from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useSurveillance } from '@/lib/hooks/useSurveillance';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { useANC } from '@/lib/hooks/useANC';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';

// ── DHIS2 Data Element definitions (South Sudan HMIS) ──
const DHIS2_DATA_ELEMENTS = [
  { id: 'DE001', name: 'OPD Attendance - New', dhis2Id: 'fbfJHSPpUQD', category: 'Service Delivery', synced: true, lastSync: '2026-02-22 08:00' },
  { id: 'DE002', name: 'Malaria Cases (Confirmed)', dhis2Id: 'qnR8r7cZRyA', category: 'Disease Surveillance', synced: true, lastSync: '2026-02-22 08:00' },
  { id: 'DE003', name: 'TB Cases (New & Relapse)', dhis2Id: 't5amVP7HJBA', category: 'Disease Surveillance', synced: false, lastSync: '2026-02-20 14:30' },
  { id: 'DE004', name: 'HIV Tests Performed', dhis2Id: 'K6f2C7Rz4mB', category: 'HIV/AIDS', synced: true, lastSync: '2026-02-22 08:00' },
  { id: 'DE005', name: 'ANC First Visit', dhis2Id: 'pq2XI5Q7sOz', category: 'Maternal Health', synced: true, lastSync: '2026-02-22 08:00' },
  { id: 'DE006', name: 'Immunizations Given', dhis2Id: 'mC7R3q0PwXk', category: 'EPI', synced: false, lastSync: '2026-02-19 16:45' },
  { id: 'DE007', name: 'Drug Stock - Antimalarials', dhis2Id: 'vN5cR8zWqFj', category: 'Commodities', synced: true, lastSync: '2026-02-22 08:00' },
  { id: 'DE008', name: 'Deaths (Facility)', dhis2Id: 'bQ4R6x3YhNp', category: 'Vital Events', synced: true, lastSync: '2026-02-22 08:00' },
  { id: 'DE009', name: 'Births Registered', dhis2Id: 'xL9dR2kWmNq', category: 'Vital Events', synced: true, lastSync: '2026-02-22 08:00' },
  { id: 'DE010', name: 'Referrals Sent', dhis2Id: 'jP3sT7vYqBx', category: 'Service Delivery', synced: true, lastSync: '2026-02-22 08:00' },
];

const DHIS2_REPORTS = [
  { name: 'Monthly HMIS Report (105)', period: 'Feb 2026', status: 'draft' as const, completeness: 78, dueDate: '2026-03-05' },
  { name: 'Weekly Epidemiological Report', period: 'Wk 8 2026', status: 'submitted' as const, completeness: 100, dueDate: '2026-02-23' },
  { name: 'Quarterly HIV Report', period: 'Q1 2026', status: 'draft' as const, completeness: 45, dueDate: '2026-04-10' },
  { name: 'Monthly Maternal Health', period: 'Feb 2026', status: 'not_started' as const, completeness: 0, dueDate: '2026-03-05' },
  { name: 'Immunization Coverage Report', period: 'Feb 2026', status: 'draft' as const, completeness: 62, dueDate: '2026-03-05' },
];

export default function DHIS2ExportPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'aggregate' | 'export' | 'log'>('overview');
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [exportLevel, setExportLevel] = useState<'facility' | 'payam' | 'county' | 'state' | 'national'>('facility');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ format: string; rows: number; date: string } | null>(null);
  const [syncLog, setSyncLog] = useState([
    { time: '08:00', message: t('dhis2.logAutoSync', { synced: 8, total: 10 }), status: 'success' as const },
    { time: '07:55', message: t('dhis2.logConnecting'), status: 'info' as const },
    { time: 'Feb 21 16:45', message: t('dhis2.logManualSync'), status: 'success' as const },
    { time: 'Feb 21 14:30', message: t('dhis2.logSyncFailedTb'), status: 'error' as const },
    { time: 'Feb 21 08:00', message: t('dhis2.logAutoSync', { synced: 7, total: 10 }), status: 'success' as const },
    { time: 'Feb 20 08:00', message: t('dhis2.logAutoSync', { synced: 10, total: 10 }), status: 'success' as const },
  ]);

  const { patients } = usePatients();
  const { alerts: diseaseAlerts } = useSurveillance();
  const { stats: immStats } = useImmunizations();
  const { stats: ancStats } = useANC();
  const { currentUser } = useApp();

  const syncedCount = DHIS2_DATA_ELEMENTS.filter(d => d.synced).length;
  const hospitalName = currentUser?.hospital?.name || currentUser?.hospitalName || '';

  // Resolve which tier of data to export. Each option picks the field(s) that
  // anchor the scope; the service derives the orgUnit from those.
  const buildExportScope = (): { hospitalId?: string; orgId?: string; payam?: string; county?: string; state?: string; role: string } | undefined => {
    if (!currentUser) return undefined;
    const base = { role: currentUser.role, orgId: currentUser.orgId };
    const u = currentUser as unknown as { payam?: string; county?: string; state?: string };
    switch (exportLevel) {
      case 'facility': return { ...base, hospitalId: currentUser.hospitalId };
      case 'payam':    return { ...base, payam: u.payam };
      case 'county':   return { ...base, county: u.county };
      case 'state':    return { ...base, state: u.state };
      case 'national': return { role: currentUser.role };
    }
  };
  const nationalAllowed = currentUser?.role === 'super_admin' || currentUser?.role === 'government';
  const u = currentUser as unknown as { payam?: string; county?: string; state?: string } | null;

  const handleSync = async () => {
    setSyncing(true);
    setSyncLog(prev => [
      { time: 'Now', message: t('dhis2.logInitiatingSync'), status: 'info' as const },
      ...prev,
    ]);
    try {
      const { generateDHIS2Export, pushDataSetToDHIS2 } = await import('@/lib/services/dhis2-export-service');
      const dataset = await generateDHIS2Export(period, buildExportScope());
      const result = await pushDataSetToDHIS2(dataset);
      const status: 'success' | 'error' | 'info' =
        result.status === 'pushed' ? 'success'
        : result.status === 'failed' ? 'error'
        : 'info';
      setSyncLog(prev => [
        { time: 'Now', message: result.message, status },
        ...prev,
      ]);
    } catch (err) {
      setSyncLog(prev => [
        { time: 'Now', message: t('dhis2.logSyncFailed', { msg: (err as Error).message }), status: 'error' as const },
        ...prev,
      ]);
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      const { generateDHIS2Export, exportToJSON, exportToCSV } = await import('@/lib/services/dhis2-export-service');
      const dataset = await generateDHIS2Export(period, buildExportScope());
      const content = format === 'json' ? exportToJSON(dataset) : exportToCSV(dataset);
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dhis2-export-${period}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportResult({ format: format.toUpperCase(), rows: dataset.dataValues?.length ?? 0, date: new Date().toLocaleString() });
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  // Aggregate summary from real patient data
  const summaryData = [
    { label: t('dhis2.summaryOpdVisits'), value: patients.length, icon: BarChart3, color: 'var(--accent-primary)' },
    { label: t('dhis2.summaryMalariaCases'), value: diseaseAlerts.filter(a => a.disease?.toLowerCase().includes('malaria')).length, icon: AlertTriangle, color: 'var(--color-danger)' },
    { label: t('dhis2.summaryActiveSurveillanceAlerts'), value: diseaseAlerts.length, icon: AlertTriangle, color: 'var(--color-warning)' },
    { label: t('dhis2.summaryAncVisits'), value: ancStats?.totalVisits || 0, icon: FileText, color: '#EC4899' },
    { label: t('dhis2.summaryImmunizationsGiven'), value: immStats?.totalVaccinations || 0, icon: CheckCircle, color: '#10B944' },
    { label: t('dhis2.summaryTotalPatients'), value: patients.length, icon: Database, color: '#8B5CF6' },
  ];

  const tabs = [
    { id: 'overview' as const, label: t('dhis2.tabDataElements'), icon: Database },
    { id: 'reports' as const, label: t('dhis2.tabHmisReports'), icon: FileText },
    { id: 'aggregate' as const, label: t('dhis2.tabAggregateData'), icon: BarChart3 },
    { id: 'export' as const, label: t('action.export'), icon: Download },
    { id: 'log' as const, label: t('dhis2.tabSyncLog'), icon: Clock },
  ];

  return (
    <>
      <TopBar title={t('dhis2.pageTitle')} actions={
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{
            background: syncing ? 'var(--overlay-medium)' : 'linear-gradient(135deg, #2191D0, #015697)',
            color: syncing ? 'var(--text-muted)' : '#fff',
            boxShadow: syncing ? 'none' : '0 4px 12px rgba(33, 145, 208, 0.3)',
          }}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? t('dhis2.syncing') : t('dhis2.syncNow')}
        </button>
      } />
      <main className="page-container page-enter">

        {/* Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: t('dhis2.statConnection'), value: t('dhis2.statConnectionActive'), icon: Wifi, color: '#10B944', sub: 'hmis.southsudan.health' },
            { label: t('dhis2.tabDataElements'), value: `${syncedCount}/${DHIS2_DATA_ELEMENTS.length}`, icon: Database, color: 'var(--accent-primary)', sub: t('sync.synced') },
            { label: t('dhis2.statReportsDue'), value: String(DHIS2_REPORTS.filter(r => r.status !== 'submitted').length), icon: FileText, color: 'var(--color-warning)', sub: t('dhis2.statPendingCompletion') },
            { label: t('dhis2.statLastSync'), value: t('dhis2.statLastSyncValue'), icon: Clock, color: '#015697', sub: 'Feb 22, 2026' },
          ].map((stat) => (
            <div key={stat.label} className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{stat.label}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b mb-5 overflow-x-auto" style={{ borderColor: 'var(--border-light)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid #2191D0' : '2px solid transparent',
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── DATA ELEMENTS TAB ── */}
        {activeTab === 'overview' && (
          <div className="card-elevated overflow-hidden">
            <div className="hidden sm:grid" style={{
              gridTemplateColumns: '2fr 1.3fr 1.2fr 0.8fr 1.2fr',
              padding: '10px 20px',
              borderBottom: '1px solid var(--border-light)',
            }}>
              {[t('dhis2.colDataElement'), t('dhis2.colDhis2Uid'), t('pharmacy.category'), t('lab.status'), t('dhis2.statLastSync')].map(h => (
                <span key={h} className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</span>
              ))}
            </div>
            {DHIS2_DATA_ELEMENTS.map((de) => (
              <div
                key={de.id}
                className="sm:grid items-center transition-colors"
                style={{
                  gridTemplateColumns: '2fr 1.3fr 1.2fr 0.8fr 1.2fr',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div className="flex items-center gap-2 mb-1 sm:mb-0">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{de.name}</span>
                </div>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{de.dhis2Id}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{de.category}</span>
                <div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    de.synced ? 'badge-normal' : 'badge-warning'
                  }`}>
                    {de.synced ? t('sync.synced') : t('lab.filterPending')}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{de.lastSync}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── HMIS REPORTS TAB ── */}
        {activeTab === 'reports' && (
          <div className="space-y-3">
            {DHIS2_REPORTS.map((report, i) => (
              <div key={i} className="card-elevated p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{report.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{report.period} · {t('dhis2.due')}: {report.dueDate}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                    report.status === 'submitted' ? 'badge-normal' :
                    report.status === 'draft' ? 'badge-info' :
                    'badge-muted'
                  }`} style={
                    report.status === 'submitted' ? {} :
                    report.status === 'draft' ? { background: 'var(--accent-light)', color: 'var(--accent-primary)' } :
                    { background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }
                  }>
                    {report.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--overlay-medium)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${report.completeness}%`,
                        background: report.completeness === 100 ? '#10B944' : report.completeness > 50 ? 'var(--accent-primary)' : 'var(--color-warning)',
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)', minWidth: '36px' }}>
                    {report.completeness}%
                  </span>
                </div>
                {report.status !== 'submitted' && (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setActiveTab('aggregate')}
                      className="text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        background: 'var(--accent-light)',
                        color: 'var(--accent-primary)',
                        border: '1px solid var(--accent-border)',
                      }}
                    >
                      <FileText className="w-3 h-3" /> {t('dhis2.reviewData')}
                    </button>
                    {report.completeness > 80 && (
                      <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        style={{
                          background: 'rgba(16,185,68,0.08)',
                          color: '#10B944',
                          border: '1px solid rgba(16,185,68,0.15)',
                          cursor: syncing ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Upload className="w-3 h-3" /> {syncing ? t('dhis2.submitting') : t('action.submit')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── AGGREGATE DATA TAB ── */}
        {activeTab === 'aggregate' && (
          <div>
            <div className="card-elevated p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('dhis2.autoAggregated')}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>February 2026 · {hospitalName}</p>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-md" style={{
                  background: 'var(--accent-light)',
                  color: 'var(--accent-primary)',
                }}>{t('dhis2.liveData')}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {summaryData.map((item) => (
                  <div key={item.label} className="p-4 rounded-xl" style={{
                    background: 'var(--overlay-subtle)',
                    border: '1px solid var(--border-light)',
                  }}>
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon className="w-4 h-4" style={{ color: item.color }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                    <p className="text-[10px] font-medium mt-1" style={{ color: item.color }}>{t('dhis2.mapsToDhis2')}</p>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #2191D0, #015697)',
                boxShadow: '0 4px 12px rgba(33, 145, 208, 0.3)',
              }}
            >
              <Upload className="w-4 h-4" />
              {t('dhis2.pushAggregateData')}
            </button>
          </div>
        )}

        {/* ── EXPORT TAB ── */}
        {activeTab === 'export' && (
          <div className="max-w-2xl">
            <div className="card-elevated p-6 mb-5">
              <h3 className="font-semibold text-sm mb-4">{t('dhis2.exportConfiguration')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('dhis2.reportingPeriod')}</label>
                  <input
                    type="month"
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    className="w-full p-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('dhis2.aggregationLevel')}</label>
                  <select
                    value={exportLevel}
                    onChange={e => setExportLevel(e.target.value as typeof exportLevel)}
                    className="w-full p-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                  >
                    <option value="facility" disabled={!currentUser?.hospitalId}>{t('dhis2.levelFacility')}{currentUser?.hospitalId ? '' : ` ${t('dhis2.noFacilityAssigned')}`}</option>
                    <option value="payam" disabled={!u?.payam}>{t('dhis2.levelPayam')}{u?.payam ? '' : ` ${t('dhis2.noneSetOnUser')}`}</option>
                    <option value="county" disabled={!u?.county}>{t('dhis2.levelCounty')}{u?.county ? '' : ` ${t('dhis2.noneSetOnUser')}`}</option>
                    <option value="state" disabled={!u?.state}>{t('dhis2.levelState')}{u?.state ? '' : ` ${t('dhis2.noneSetOnUser')}`}</option>
                    <option value="national" disabled={!nationalAllowed}>{t('dhis2.levelNational')}{nationalAllowed ? '' : ` ${t('dhis2.nationalRestricted')}`}</option>
                  </select>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{t('dhis2.tierHelp')}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>{t('dhis2.dataElementsIncluded')}</label>
                  <div className="space-y-1.5">
                    {[
                      t('dhis2.includePopulationHealth'),
                      t('dhis2.includeCrvs'),
                      t('dhis2.includeMortality'),
                      t('dhis2.includeSurveillance'),
                      t('dhis2.includeDataQuality'),
                      t('dhis2.includePerFacility'),
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-elevated p-6 mb-5">
              <h3 className="font-semibold text-sm mb-4">{t('dhis2.exportFormat')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                  className="p-4 rounded-xl border text-left transition-all hover:shadow-md"
                  style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FileJson className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    <span className="font-semibold text-sm">JSON</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dhis2.jsonDesc')}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {t('dhis2.downloadJson')}
                  </div>
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className="p-4 rounded-xl border text-left transition-all hover:shadow-md"
                  style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FileSpreadsheet className="w-5 h-5" style={{ color: '#10B944' }} />
                    <span className="font-semibold text-sm">CSV</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dhis2.csvDesc')}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium" style={{ color: '#10B944' }}>
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {t('dhis2.downloadCsv')}
                  </div>
                </button>
              </div>
            </div>

            {exportResult && (
              <div className="card-elevated p-4" style={{ background: 'rgba(33, 145, 208, 0.06)', border: '1px solid var(--accent-border)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--accent-primary)' }}>{t('dhis2.exportSuccessful')}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t('dhis2.exportSummary', { rows: exportResult.rows, format: exportResult.format, period, date: exportResult.date })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── SYNC LOG TAB ── */}
        {activeTab === 'log' && (
          <div className="card-elevated overflow-hidden">
            {syncLog.map((log, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-5 py-3 transition-colors"
                style={{
                  borderBottom: '1px solid var(--border-light)',
                  animation: i === 0 ? 'slideIn 0.3s ease' : undefined,
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
                  background: log.status === 'success' ? '#10B944' : log.status === 'error' ? 'var(--color-danger)' : 'var(--accent-primary)',
                }} />
                <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: '110px' }}>{log.time}</span>
                <span className="text-sm" style={{
                  color: log.status === 'error' ? 'var(--color-danger)' : 'var(--text-secondary)',
                }}>{log.message}</span>
              </div>
            ))}
            {syncLog.length === 0 && (
              <div className="text-center py-12">
                <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('dhis2.noSyncActivity')}</p>
              </div>
            )}
          </div>
        )}

      </main>
    </>
  );
}
