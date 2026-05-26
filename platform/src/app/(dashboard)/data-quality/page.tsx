'use client';

import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useDataQuality } from '@/lib/hooks/useDataQuality';
import { Database, Wifi, Users, TrendingUp, BarChart3, Clock, CheckCircle2, Activity } from '@/components/icons/lucide';

export default function DataQualityPage() {
  const { data, loading } = useDataQuality();

  if (loading || !data) return <><TopBar title="Data Quality" /><main className="page-container flex items-center justify-center"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading data quality metrics...</p></main></>;

  const scoreColor = (score: number) => score >= 70 ? 'var(--accent-primary)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
  const scoreBg = (score: number) => score >= 70 ? 'rgba(43,111,224,0.12)' : score >= 50 ? 'rgba(252,211,77,0.12)' : 'rgba(229,46,66,0.12)';

  return (
    <>
      <TopBar title="Data Quality" />
      <main className="page-container page-enter">
        <PageHeader
          icon={Database}
          title="Data Quality & Completeness"
          subtitle="National HIS data quality monitoring — WHO assessment framework"
        />

        {/* National summary cards */}
        <div className="kpi-grid mb-6">
          {[
            { label: 'Avg Completeness', value: `${data.avgCompleteness}%`, icon: CheckCircle2, color: scoreColor(data.avgCompleteness), bg: scoreBg(data.avgCompleteness) },
            { label: 'Avg Timeliness', value: `${data.avgTimeliness}%`, icon: Clock, color: scoreColor(data.avgTimeliness), bg: scoreBg(data.avgTimeliness) },
            { label: 'Avg Data Quality', value: `${data.avgQuality}%`, icon: Activity, color: scoreColor(data.avgQuality), bg: scoreBg(data.avgQuality) },
            { label: 'DHIS2 Adoption', value: `${data.dhis2Adoption}%`, icon: Wifi, color: scoreColor(data.dhis2Adoption), bg: scoreBg(data.dhis2Adoption) },
          ].map(stat => (
            <div key={stat.label} className="kpi">
              <div className="kpi__icon" style={{ background: stat.bg }}>
                <stat.icon style={{ color: stat.color }} />
              </div>
              <div className="kpi__body">
                <div className="kpi__value">{stat.value}</div>
                <div className="kpi__label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* National indicators */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card-elevated p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              National Data Quality Indicators
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Reporting Completeness', value: data.avgCompleteness, target: 80 },
                { label: 'Reporting Timeliness', value: data.avgTimeliness, target: 75 },
                { label: 'Data Accuracy/Quality', value: data.avgQuality, target: 70 },
                { label: 'Facilities with ≥80% completeness', value: data.completenessRate, target: 60 },
                { label: 'DHIS2 Electronic Reporting', value: data.dhis2Adoption, target: 50 },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="font-bold" style={{ color: scoreColor(item.value) }}>{item.value}%
                      <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>/ {item.target}%</span>
                    </span>
                  </div>
                  <div className="relative w-full h-3 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${item.value}%`, background: scoreColor(item.value) }} />
                    <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${item.target}%`, background: 'var(--text-muted)', opacity: 0.5 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              HIS Workforce
            </h3>
            <div className="space-y-4">
              <div className="p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total HIS Staff</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--accent-primary)' }}>{data.totalHISStaff}</p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Across {data.facilitiesWithTrainedStaff} facilities with trained staff</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Staff Coverage</p>
                <p className="text-3xl font-bold" style={{ color: scoreColor(data.totalFacilities ? Math.round(data.facilitiesWithTrainedStaff / data.totalFacilities * 100) : 0) }}>
                  {data.totalFacilities ? Math.round(data.facilitiesWithTrainedStaff / data.totalFacilities * 100) : 0}%
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{data.facilitiesWithTrainedStaff} of {data.totalFacilities} facilities have trained HIS staff</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: data.dhis2Adoption >= 50 ? 'rgba(43,111,224,0.08)' : 'rgba(229,46,66,0.08)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Wifi className="w-3.5 h-3.5" style={{ color: scoreColor(data.dhis2Adoption) }} />
                  <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Electronic Reporting</p>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {data.totalFacilities ? Math.round(data.dhis2Adoption * data.totalFacilities / 100) : 0} facilities using DHIS2 for electronic reporting
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Per-facility table */}
        <div className="card-elevated overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              Facility-Level Data Quality
            </h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)' }} /> ≥70%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-warning)' }} /> 50–69%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-danger)' }} /> &lt;50%</span>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>State</th>
                <th>Completeness</th>
                <th>Timeliness</th>
                <th>Data Quality</th>
                <th>DHIS2</th>
                <th>HIS Staff</th>
                <th>Last Assessment</th>
              </tr>
            </thead>
            <tbody>
              {(data.entries || []).map(e => (
                <tr key={e.facilityId}>
                  <td className="font-medium text-sm">{e.facilityName.replace(' Hospital', '').replace(' Teaching', '')}</td>
                  <td className="text-xs">{e.state}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--overlay-light)', maxWidth: '60px' }}>
                        <div className="h-full rounded-full" style={{ width: `${e.reportingCompleteness}%`, background: scoreColor(e.reportingCompleteness) }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: scoreColor(e.reportingCompleteness) }}>{e.reportingCompleteness}%</span>
                    </div>
                  </td>
                  <td>
                    <span className="text-xs font-bold" style={{ color: scoreColor(e.reportingTimeliness) }}>{e.reportingTimeliness}%</span>
                  </td>
                  <td>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: scoreBg(e.dataQualityScore), color: scoreColor(e.dataQualityScore) }}>{e.dataQualityScore}%</span>
                  </td>
                  <td>
                    {e.hasDHIS2 ? (
                      <span className="badge badge-normal text-[10px]">Yes</span>
                    ) : (
                      <span className="badge badge-warning text-[10px]">No</span>
                    )}
                  </td>
                  <td className="text-sm text-center">{e.hisStaffCount}</td>
                  <td className="text-xs font-mono" style={{ color: e.lastAssessmentDate ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {e.lastAssessmentDate || 'Not assessed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
