'use client';

import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useVitalStatistics } from '@/lib/hooks/useVitalStatistics';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useDataQuality } from '@/lib/hooks/useDataQuality';
import { useFacilityAssessments } from '@/lib/hooks/useFacilityAssessments';
import { Globe, Baby, Skull, Activity, Heart, Shield, Building2, Users, BedDouble, Stethoscope, Wifi } from '@/components/icons/lucide';

export default function PublicStatsPage() {
  const { data: vitalData, loading: vLoading } = useVitalStatistics();
  const { hospitals } = useHospitals();
  const { data: dqData, loading: dqLoading } = useDataQuality();
  const { summary: assessmentSummary } = useFacilityAssessments();

  const loading = vLoading || dqLoading;

  if (loading || !vitalData) return <><TopBar title="Public Statistics" /><main className="page-container flex items-center justify-center"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading public statistics...</p></main></>;

  const { birthStats, deathStats } = vitalData;
  const totalPop = hospitals.reduce((s, h) => s + h.patientCount, 0);
  const totalBeds = hospitals.reduce((s, h) => s + h.totalBeds, 0);
  const totalStaff = hospitals.reduce((s, h) => s + h.doctors + h.nurses + h.clinicalOfficers, 0);

  const scoreColor = (score: number) => score >= 70 ? 'var(--accent-primary)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';

  return (
    <>
      <TopBar title="Public Statistics" />
      <main className="page-container page-enter">
        <PageHeader
          icon={Globe}
          title="Public Health Statistics"
          subtitle="Republic of South Sudan — National Health Indicators Portal"
        />

        {/* National Overview */}
        <div className="card-elevated p-5 mb-6" style={{ background: 'rgba(43,111,224,0.04)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <h2 className="font-semibold text-sm">National Health System Overview</h2>
          </div>
          <div className="kpi-grid">
            {[
              { label: 'Health Facilities', value: hospitals.length, icon: Building2, color: 'var(--accent-primary)', bg: 'rgba(43,111,224,0.12)' },
              { label: 'Total Patients', value: totalPop.toLocaleString(), icon: Users, color: 'var(--accent-primary)', bg: 'rgba(43,111,224,0.12)' },
              { label: 'Hospital Beds', value: totalBeds.toLocaleString(), icon: BedDouble, color: 'var(--color-warning)', bg: 'rgba(252,211,77,0.12)' },
              { label: 'Health Workers', value: totalStaff.toLocaleString(), icon: Stethoscope, color: '#5CB8A8', bg: 'rgba(56,189,248,0.12)' },
              { label: 'DHIS2 Coverage', value: `${dqData?.dhis2Adoption ?? 0}%`, icon: Wifi, color: scoreColor(dqData?.dhis2Adoption ?? 0), bg: 'rgba(43,111,224,0.12)' },
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
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* CRVS - Births */}
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-4">
              <Baby className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <h2 className="font-semibold text-sm">Birth Registration (CRVS)</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg" style={{ background: 'var(--accent-light)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Births Registered</p>
                <p className="text-xl font-bold" style={{ color: 'var(--accent-primary)' }}>{birthStats.total}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--accent-light)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>This Month</p>
                <p className="text-xl font-bold" style={{ color: 'var(--accent-primary)' }}>{birthStats.thisMonth}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Male births</span>
                <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>{birthStats.byGender.male}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Female births</span>
                <span className="font-bold" style={{ color: 'var(--color-danger)' }}>{birthStats.byGender.female}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Caesarean rate</span>
                <span className="font-bold">{birthStats.total ? Math.round(birthStats.byDeliveryType.caesarean / birthStats.total * 100) : 0}%</span>
              </div>
            </div>
            {Object.keys(birthStats.byState).length > 0 && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Births by State</p>
                <div className="space-y-1.5">
                  {Object.entries(birthStats.byState).sort(([, a], [, b]) => b - a).map(([state, count]) => (
                    <div key={state} className="flex items-center gap-2">
                      <span className="text-[10px] w-36 truncate" style={{ color: 'var(--text-muted)' }}>{state}</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                        <div className="h-full rounded-full" style={{ width: `${birthStats.total ? (count / birthStats.total) * 100 : 0}%`, background: 'var(--accent-primary)' }} />
                      </div>
                      <span className="text-[10px] font-bold w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CRVS - Deaths */}
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-4">
              <Skull className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
              <h2 className="font-semibold text-sm">Mortality Statistics (CRVS)</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg" style={{ background: 'rgba(229,46,66,0.08)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Deaths</p>
                <p className="text-xl font-bold" style={{ color: 'var(--color-danger)' }}>{deathStats.total}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--accent-light)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ICD-11 Coded</p>
                <p className="text-xl font-bold" style={{ color: 'var(--accent-primary)' }}>{deathStats.total ? Math.round(deathStats.withICD11Code / deathStats.total * 100) : 0}%</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Maternal deaths</span>
                <span className="font-bold" style={{ color: 'var(--color-danger)' }}>{deathStats.maternalDeaths}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Under-5 deaths</span>
                <span className="font-bold" style={{ color: 'var(--color-warning)' }}>{deathStats.under5Deaths}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Neonatal deaths</span>
                <span className="font-bold" style={{ color: 'var(--color-warning)' }}>{deathStats.neonatalDeaths}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Death notification rate</span>
                <span className="font-bold" style={{ color: scoreColor(deathStats.total ? Math.round(deathStats.notified / deathStats.total * 100) : 0) }}>
                  {deathStats.total ? Math.round(deathStats.notified / deathStats.total * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Death registration rate</span>
                <span className="font-bold" style={{ color: scoreColor(deathStats.total ? Math.round(deathStats.registered / deathStats.total * 100) : 0) }}>
                  {deathStats.total ? Math.round(deathStats.registered / deathStats.total * 100) : 0}%
                </span>
              </div>
            </div>
            {deathStats.topCauses.length > 0 && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Top Causes of Death</p>
                <div className="space-y-1.5">
                  {deathStats.topCauses.slice(0, 5).map((c, i) => (
                    <div key={c.code} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold w-4" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                      <span className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>{c.code}</span>
                      <span className="text-[10px] flex-1 truncate">{c.cause}</span>
                      <span className="text-xs font-bold">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Health System Readiness */}
        {assessmentSummary && (
          <div className="card-elevated p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <h2 className="font-semibold text-sm">Health System Readiness</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{assessmentSummary.facilitiesAssessed} facilities assessed</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-3">
                {[
                  { label: 'General Equipment', score: assessmentSummary.avgEquipmentScore },
                  { label: 'Diagnostic Capacity', score: assessmentSummary.avgDiagnosticScore },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span className="font-bold" style={{ color: scoreColor(item.score) }}>{item.score}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                      <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: scoreColor(item.score) }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Essential Medicines', score: assessmentSummary.avgMedicinesScore },
                  { label: 'Staffing Adequacy', score: assessmentSummary.avgStaffingScore },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span className="font-bold" style={{ color: scoreColor(item.score) }}>{item.score}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                      <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: scoreColor(item.score) }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Data Quality', score: assessmentSummary.avgDataQuality },
                  { label: 'Reporting Completeness', score: assessmentSummary.avgReportingCompleteness },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span className="font-bold" style={{ color: scoreColor(item.score) }}>{item.score}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                      <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: scoreColor(item.score) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Quality Summary */}
        {dqData && (
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
              <h2 className="font-semibold text-sm">Data Quality Indicators</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg text-center" style={{ background: 'var(--overlay-subtle)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Completeness</p>
                <p className="text-xl font-bold" style={{ color: scoreColor(dqData.avgCompleteness) }}>{dqData.avgCompleteness}%</p>
              </div>
              <div className="p-3 rounded-lg text-center" style={{ background: 'var(--overlay-subtle)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Timeliness</p>
                <p className="text-xl font-bold" style={{ color: scoreColor(dqData.avgTimeliness) }}>{dqData.avgTimeliness}%</p>
              </div>
              <div className="p-3 rounded-lg text-center" style={{ background: 'var(--overlay-subtle)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Accuracy</p>
                <p className="text-xl font-bold" style={{ color: scoreColor(dqData.avgQuality) }}>{dqData.avgQuality}%</p>
              </div>
              <div className="p-3 rounded-lg text-center" style={{ background: 'var(--overlay-subtle)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>HIS Workforce</p>
                <p className="text-xl font-bold" style={{ color: 'var(--accent-primary)' }}>{dqData.totalHISStaff}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
