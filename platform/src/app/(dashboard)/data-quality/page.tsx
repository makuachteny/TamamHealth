'use client';

import TopBar from '@/components/TopBar';
import { useDataQuality } from '@/lib/hooks/useDataQuality';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Wifi, Users, TrendingUp, BarChart3 } from '@/components/icons/lucide';
import Badge from '@/components/Badge';

export default function DataQualityPage() {
  const { t } = useTranslation();
  const { data, loading } = useDataQuality();

  if (loading || !data) return <><TopBar title={t('dataQuality.topBarTitle')} /><main className="page-container flex items-center justify-center"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('dataQuality.loading')}</p></main></>;

  const scoreColor = (score: number) => score >= 70 ? 'var(--accent-primary)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
  const scoreBg = (score: number) => score >= 70 ? 'rgba(33, 145, 208, 0.12)' : score >= 50 ? 'rgba(252,211,77,0.12)' : 'rgba(229,46,66,0.12)';

  return (
    <>
      <TopBar title={t('dataQuality.topBarTitle')} />
      <main className="page-container page-enter">
        {/* National indicators */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card-elevated p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              {t('dataQuality.nationalIndicatorsTitle')}
            </h3>
            <div className="space-y-3">
              {[
                { label: t('dataQuality.indicatorReportingCompleteness'), value: data.avgCompleteness, target: 80 },
                { label: t('dataQuality.indicatorReportingTimeliness'), value: data.avgTimeliness, target: 75 },
                { label: t('dataQuality.indicatorDataAccuracy'), value: data.avgQuality, target: 70 },
                { label: t('dataQuality.indicatorFacilitiesCompleteness'), value: data.completenessRate, target: 60 },
                { label: t('dataQuality.indicatorDhis2Reporting'), value: data.dhis2Adoption, target: 50 },
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
              {t('dataQuality.hisWorkforceTitle')}
            </h3>
            <div className="space-y-4">
              <div className="p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('dataQuality.totalHisStaff')}</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--accent-primary)' }}>{data.totalHISStaff}</p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('dataQuality.acrossFacilitiesTrained', { count: data.facilitiesWithTrainedStaff })}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('dataQuality.staffCoverage')}</p>
                <p className="text-3xl font-bold" style={{ color: scoreColor(data.totalFacilities ? Math.round(data.facilitiesWithTrainedStaff / data.totalFacilities * 100) : 0) }}>
                  {data.totalFacilities ? Math.round(data.facilitiesWithTrainedStaff / data.totalFacilities * 100) : 0}%
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('dataQuality.facilitiesWithTrainedStaff', { trained: data.facilitiesWithTrainedStaff, total: data.totalFacilities })}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: data.dhis2Adoption >= 50 ? 'rgba(33, 145, 208, 0.08)' : 'rgba(229,46,66,0.08)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Wifi className="w-3.5 h-3.5" style={{ color: scoreColor(data.dhis2Adoption) }} />
                  <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('dataQuality.electronicReporting')}</p>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('dataQuality.facilitiesUsingDhis2', { count: data.totalFacilities ? Math.round(data.dhis2Adoption * data.totalFacilities / 100) : 0 })}
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
              {t('dataQuality.facilityLevelTitle')}
            </h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)' }} /> ≥70%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-warning)' }} /> 50–69%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-danger)' }} /> &lt;50%</span>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <th>{t('dataQuality.thFacility')}</th>
                <th>{t('dataQuality.thState')}</th>
                <th>{t('dataQuality.thCompleteness')}</th>
                <th>{t('dataQuality.thTimeliness')}</th>
                <th>{t('dataQuality.thDataQuality')}</th>
                <th>{t('dataQuality.thDhis2')}</th>
                <th>{t('dataQuality.thHisStaff')}</th>
                <th>{t('dataQuality.thLastAssessment')}</th>
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
                      <Badge tone="success">{t('dataQuality.yes')}</Badge>
                    ) : (
                      <Badge tone="warning">{t('dataQuality.no')}</Badge>
                    )}
                  </td>
                  <td className="text-sm text-center">{e.hisStaffCount}</td>
                  <td className="text-xs font-mono" style={{ color: e.lastAssessmentDate ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {e.lastAssessmentDate || t('dataQuality.notAssessed')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </main>
    </>
  );
}
