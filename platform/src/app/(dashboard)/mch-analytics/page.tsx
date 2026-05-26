'use client';

import { useState } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useMCHAnalytics } from '@/lib/hooks/useMCHAnalytics';
import {
  HeartPulse, Baby, Syringe, AlertTriangle,
  Shield, Users, Activity, Heart,
  ChevronDown, ChevronRight, Eye,
} from '@/components/icons/lucide';
import { SOUTH_SUDAN_STATES } from '@/lib/geographic-data';

type TabView = 'overview' | 'anc' | 'births' | 'mortality' | 'immunization' | 'high-risk';

export default function MCHAnalyticsPage() {
  const { data, loading } = useMCHAnalytics();
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [expandedMother, setExpandedMother] = useState<string | null>(null);

  if (loading || !data) {
    return (
      <>
        <TopBar title="MCH Analytics" />
        <main className="page-container flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(236,72,153,0.1)' }}>
              <HeartPulse className="w-8 h-8" style={{ color: '#EC4899' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Loading MCH analytics...</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Analyzing maternal & child health data</p>
          </div>
        </main>
      </>
    );
  }

  const { summary, ancCascade, maternalMortality, birthOutcomes, neonatalData, immunizationGaps, highRiskPregnancies } = data;

  const gradeColors: Record<string, { bg: string; text: string }> = {
    A: { bg: 'rgba(74,222,128,0.12)', text: 'var(--color-success)' },
    B: { bg: 'rgba(56,189,248,0.12)', text: '#5CB8A8' },
    C: { bg: 'rgba(251,191,36,0.12)', text: 'var(--color-warning)' },
    D: { bg: 'rgba(251,146,60,0.12)', text: '#FB923C' },
    F: { bg: 'rgba(248,113,113,0.12)', text: '#F87171' },
  };

  const grade = gradeColors[summary.overallGrade] || gradeColors.F;
  const scoreColor = (v: number, target: number) => v >= target ? 'var(--color-success)' : v >= target * 0.6 ? 'var(--color-warning)' : '#F87171';

  const tabs: { key: TabView; label: string; icon: typeof HeartPulse }[] = [
    { key: 'overview', label: 'Overview', icon: Eye },
    { key: 'anc', label: 'ANC Cascade', icon: HeartPulse },
    { key: 'births', label: 'Birth Outcomes', icon: Baby },
    { key: 'mortality', label: 'Mortality', icon: Heart },
    { key: 'immunization', label: 'Immunization', icon: Syringe },
    { key: 'high-risk', label: 'High Risk', icon: AlertTriangle },
  ];

  return (
    <>
      <TopBar title="MCH Analytics" />
      <main className="page-container page-enter">

        <PageHeader
          icon={HeartPulse}
          title="Maternal & Child Health Analytics"
          subtitle="WHO RMNCH · SDG 3.1 & 3.2 · Continuum of Care Tracking"
          actions={
            <>
              <div className="px-4 py-2 rounded-md flex items-center gap-2" style={{
                background: grade.bg,
                border: `1px solid ${grade.text}30`,
              }}>
                <Shield className="w-4 h-4" style={{ color: grade.text }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: grade.text }}>
                  Grade: {summary.overallGrade}
                </span>
              </div>
              <div className="px-3 py-2 rounded-md" style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.15)' }}>
                <p className="text-[10px] font-semibold" style={{ color: '#EC4899' }}>{summary.highRiskCount} High Risk</p>
              </div>
            </>
          }
        />

        {/* ═══ KPI STRIP ═══ */}
        <div className="kpi-grid mb-4">
          {[
            { label: 'Mothers Tracked', value: summary.totalMothersTracked, icon: Users, color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
            { label: 'ANC4+ Rate', value: `${summary.anc4PlusCoverage}%`, icon: HeartPulse, color: scoreColor(summary.anc4PlusCoverage, 50), bg: 'rgba(236,72,153,0.08)' },
            { label: 'MMR /100k', value: summary.maternalMortalityRatio.toLocaleString(), icon: Heart, color: summary.maternalMortalityRatio > 500 ? '#F87171' : 'var(--color-warning)', bg: summary.maternalMortalityRatio > 500 ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)' },
            { label: 'NMR /1000', value: summary.neonatalMortalityRate, icon: Baby, color: summary.neonatalMortalityRate > 30 ? '#F87171' : 'var(--color-warning)', bg: summary.neonatalMortalityRate > 30 ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)' },
            { label: 'Immunization', value: `${summary.immunizationCoverage}%`, icon: Syringe, color: scoreColor(summary.immunizationCoverage, 80), bg: 'rgba(236,72,153,0.08)' },
            { label: 'Facility Births', value: `${summary.facilityDeliveryRate}%`, icon: Activity, color: scoreColor(summary.facilityDeliveryRate, 50), bg: 'rgba(236,72,153,0.08)' },
            { label: 'High Risk', value: summary.highRiskCount, icon: AlertTriangle, color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
          ].map((kpi) => (
            <div key={kpi.label} className="kpi">
              <div className="kpi__icon" style={{ background: kpi.bg }}>
                <kpi.icon style={{ color: kpi.color }} />
              </div>
              <div className="kpi__body">
                <div className="kpi__value">{kpi.value}</div>
                <div className="kpi__label">{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ TAB NAVIGATION ═══ */}
        <div className="flex gap-1 mb-4 p-1 rounded-md" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                border: activeTab === tab.key ? '1px solid var(--border-light)' : '1px solid transparent',
                boxShadow: activeTab === tab.key ? 'var(--card-shadow)' : 'none',
              }}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* ANC Cascade Visual */}
            <div className="card-elevated">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <HeartPulse className="w-4 h-4" style={{ color: '#EC4899' }} />
                  ANC Coverage Cascade
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {[
                  { label: 'ANC1 (1st visit)', value: ancCascade.anc1, rate: ancCascade.anc1Rate, target: 90, color: '#EC4899' },
                  { label: 'ANC4+ (4 visits)', value: ancCascade.anc4, rate: ancCascade.anc4Rate, target: 50, color: '#A855F7' },
                  { label: 'ANC8 (WHO target)', value: ancCascade.anc8, rate: ancCascade.anc8Rate, target: 30, color: '#6366F1' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.value} mothers</span>
                        <span className="text-sm font-bold" style={{ color: item.rate >= item.target ? 'var(--color-success)' : item.color }}>{item.rate}%</span>
                      </div>
                    </div>
                    <div className="relative h-4 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(100, item.rate)}%`,
                        background: `linear-gradient(90deg, ${item.color}, ${item.color}80)`,
                      }} />
                      <div className="absolute top-0 bottom-0 w-0.5" style={{
                        left: `${item.target}%`,
                        background: 'var(--text-muted)',
                        opacity: 0.5,
                      }} />
                      <span className="absolute text-[7px] font-mono" style={{
                        left: `${item.target}%`,
                        top: '-12px',
                        transform: 'translateX(-50%)',
                        color: 'var(--text-muted)',
                      }}>Target: {item.target}%</span>
                    </div>
                  </div>
                ))}
                <div className="p-2 rounded-lg text-center mt-2" style={{ background: 'var(--overlay-subtle)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Drop-off ANC1→ANC4: <strong style={{ color: '#FB923C' }}>{ancCascade.anc1Rate - ancCascade.anc4Rate}%</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Maternal Mortality Snapshot */}
            <div className="card-elevated">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Heart className="w-4 h-4" style={{ color: '#F87171' }} />
                  Maternal Mortality
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="p-3 rounded-md text-center" style={{
                  background: maternalMortality.mmr > 500 ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)',
                  border: `1px solid ${maternalMortality.mmr > 500 ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)'}`,
                }}>
                  <p className="text-3xl font-bold stat-value" style={{
                    color: maternalMortality.mmr > 500 ? '#F87171' : 'var(--color-warning)',
                  }}>{maternalMortality.mmr.toLocaleString()}</p>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mt-1" style={{ color: 'var(--text-muted)' }}>
                    MMR per 100,000 live births
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>SDG target: 70 | South Sudan avg: 1,150</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg text-center" style={{ background: 'var(--overlay-subtle)' }}>
                    <p className="text-lg font-bold" style={{ color: '#F87171' }}>{maternalMortality.totalMaternalDeaths}</p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Maternal Deaths</p>
                  </div>
                  <div className="p-2 rounded-lg text-center" style={{ background: 'var(--overlay-subtle)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{maternalMortality.totalLiveBirths}</p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Live Births</p>
                  </div>
                </div>

                {/* Top causes */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Top Causes</p>
                  {maternalMortality.directCauses.slice(0, 4).map(c => (
                    <div key={c.cause} className="flex items-center justify-between py-1.5 text-xs" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{c.cause}</span>
                      <span className="font-bold" style={{ color: '#F87171' }}>{c.count} ({c.percentage}%)</span>
                    </div>
                  ))}
                  {maternalMortality.directCauses.length === 0 && (
                    <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>No maternal death data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Neonatal & Child Health */}
            <div className="card-elevated">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Baby className="w-4 h-4" style={{ color: '#5CB8A8' }} />
                  Child Mortality
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'Neonatal (<28 days)', value: neonatalData.neonatalMortalityRate, deaths: neonatalData.totalNeonatalDeaths, target: 12, unit: '/1,000 LB' },
                  { label: 'Infant (<1 year)', value: neonatalData.infantMortalityRate, deaths: neonatalData.totalInfantDeaths, target: 25, unit: '/1,000 LB' },
                  { label: 'Under-5', value: neonatalData.under5MortalityRate, deaths: neonatalData.totalUnder5Deaths, target: 25, unit: '/1,000 LB' },
                ].map(item => {
                  const color = item.value > item.target * 2 ? '#F87171' : item.value > item.target ? 'var(--color-warning)' : 'var(--color-success)';
                  return (
                    <div key={item.label} className="p-3 rounded-md" style={{ background: `${color}08`, border: `1px solid ${color}15` }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{item.deaths} deaths</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold" style={{ color }}>{item.value}</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.unit}</span>
                      </div>
                      <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>SDG target: {item.target}</p>
                    </div>
                  );
                })}

                {/* Top causes */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Top Under-5 Causes</p>
                  {neonatalData.topCauses.slice(0, 4).map(c => (
                    <div key={c.cause} className="flex items-center justify-between py-1 text-[11px]">
                      <span style={{ color: 'var(--text-secondary)' }}>{c.cause}</span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Immunization Coverage Overview */}
            <div className="lg:col-span-2 card-elevated">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Syringe className="w-4 h-4" style={{ color: '#A855F7' }} />
                  Immunization Coverage & Gaps
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {immunizationGaps.map(gap => {
                    const color = gap.coverageRate >= 80 ? 'var(--color-success)' : gap.coverageRate >= 50 ? 'var(--color-warning)' : '#F87171';
                    return (
                      <div key={gap.vaccine} className="p-3 rounded-md" style={{
                        background: 'var(--overlay-subtle)',
                        border: '1px solid var(--border-light)',
                      }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{gap.vaccine}</span>
                          <span className="text-sm font-bold" style={{ color }}>{gap.coverageRate}%</span>
                        </div>
                        <div className="h-2 rounded-full mb-2" style={{ background: 'var(--overlay-light)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${gap.coverageRate}%`,
                            background: `linear-gradient(90deg, ${color}80, ${color})`,
                          }} />
                        </div>
                        <div className="flex justify-between text-[9px]">
                          <span style={{ color: 'var(--text-muted)' }}>{gap.vaccinated}/{gap.targetPopulation}</span>
                          {gap.dropoutRate > 0 && (
                            <span style={{ color: '#FB923C' }}>Dropout: {gap.dropoutRate}%</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Birth Outcomes Quick */}
            <div className="card-elevated">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Baby className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                  Birth Outcomes
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'Total Births', value: birthOutcomes.totalBirths, color: 'var(--accent-primary)' },
                  { label: 'Facility Delivery', value: `${birthOutcomes.facilityDeliveryRate}%`, color: scoreColor(birthOutcomes.facilityDeliveryRate, 50) },
                  { label: 'Caesarean Rate', value: `${birthOutcomes.caesareanRate}%`, color: birthOutcomes.caesareanRate > 5 && birthOutcomes.caesareanRate < 15 ? 'var(--color-success)' : 'var(--color-warning)' },
                  { label: 'Low Birth Weight', value: `${birthOutcomes.lowBirthWeightRate}%`, color: birthOutcomes.lowBirthWeightRate > 15 ? '#F87171' : 'var(--color-warning)' },
                  { label: 'Avg Birth Weight', value: `${birthOutcomes.averageBirthWeight}g`, color: birthOutcomes.averageBirthWeight >= 2500 ? 'var(--color-success)' : '#F87171' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ANC CASCADE TAB ═══ */}
        {activeTab === 'anc' && (
          <div className="space-y-4">
            {/* Large cascade visual */}
            <div className="card-elevated p-6">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <HeartPulse className="w-4 h-4" style={{ color: '#EC4899' }} />
                ANC Coverage Cascade — WHO Recommended 8+ Contacts
              </h3>
              <div className="flex items-end justify-center gap-6" style={{ height: '240px' }}>
                {[
                  { label: 'ANC1', value: ancCascade.anc1, rate: ancCascade.anc1Rate, color: '#EC4899' },
                  { label: 'ANC4+', value: ancCascade.anc4, rate: ancCascade.anc4Rate, color: '#A855F7' },
                  { label: 'ANC8+', value: ancCascade.anc8, rate: ancCascade.anc8Rate, color: '#6366F1' },
                ].map(item => {
                  const maxRate = Math.max(ancCascade.anc1Rate, 1);
                  const barHeight = (item.rate / maxRate) * 100;
                  return (
                    <div key={item.label} className="flex flex-col items-center gap-2" style={{ width: '120px' }}>
                      <p className="text-2xl font-bold" style={{ color: item.color }}>{item.rate}%</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.value} mothers</p>
                      <div className="w-full flex flex-col justify-end" style={{ height: '140px' }}>
                        <div className="w-full rounded-t-xl transition-all" style={{
                          height: `${barHeight}%`,
                          minHeight: '8px',
                          background: `linear-gradient(180deg, ${item.color}, ${item.color}40)`,
                        }} />
                      </div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By state table */}
            <div className="card-elevated overflow-hidden">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>ANC Coverage by State</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Total Pregnancies</th>
                    <th>ANC1</th>
                    <th>ANC4+</th>
                    <th>ANC8+</th>
                    <th>ANC4 Rate</th>
                    <th>Drop-off</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ancCascade.byState)
                    .filter(([, d]) => d.total > 0)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([state, d]) => {
                      const anc4Rate = d.total > 0 ? Math.round((d.anc4 / d.total) * 100) : 0;
                      const dropoff = d.anc1 > 0 ? Math.round(((d.anc1 - d.anc4) / d.anc1) * 100) : 0;
                      return (
                        <tr key={state}>
                          <td className="font-medium text-sm">{state}</td>
                          <td>{d.total}</td>
                          <td className="font-semibold">{d.anc1}</td>
                          <td className="font-semibold">{d.anc4}</td>
                          <td>{d.anc8}</td>
                          <td>
                            <span className="font-bold" style={{ color: anc4Rate >= 50 ? 'var(--color-success)' : anc4Rate >= 30 ? 'var(--color-warning)' : '#F87171' }}>
                              {anc4Rate}%
                            </span>
                          </td>
                          <td>
                            <span className="text-xs" style={{ color: dropoff > 50 ? '#F87171' : '#FB923C' }}>
                              {dropoff}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ BIRTHS TAB ═══ */}
        {activeTab === 'births' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Births', value: birthOutcomes.totalBirths, color: 'var(--accent-primary)' },
                { label: 'Facility Delivery', value: `${birthOutcomes.facilityDeliveryRate}%`, color: scoreColor(birthOutcomes.facilityDeliveryRate, 50) },
                { label: 'Caesarean Rate', value: `${birthOutcomes.caesareanRate}%`, color: '#A855F7' },
                { label: 'Low Birth Weight', value: `${birthOutcomes.lowBirthWeightRate}%`, sub: `${birthOutcomes.lowBirthWeight} babies`, color: birthOutcomes.lowBirthWeightRate > 15 ? '#F87171' : 'var(--color-warning)' },
              ].map(item => (
                <div key={item.label} className="card-elevated p-4">
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                  {'sub' in item && item.sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.sub}</p>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Delivery Type */}
              <div className="card-elevated p-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Baby className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  By Delivery Type
                </h3>
                <div className="space-y-3">
                  {Object.entries(birthOutcomes.byDeliveryType).map(([type, count]) => {
                    const pct = birthOutcomes.totalBirths > 0 ? Math.round((count / birthOutcomes.totalBirths) * 100) : 0;
                    const color = type === 'normal' ? 'var(--color-success)' : type === 'caesarean' ? '#A855F7' : '#5CB8A8';
                    return (
                      <div key={type}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{type}</span>
                          <span className="font-bold" style={{ color }}>{count} ({pct}%)</span>
                        </div>
                        <div className="h-3 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Birth Attendant */}
              <div className="card-elevated p-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Users className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  By Birth Attendant
                </h3>
                <div className="space-y-3">
                  {Object.entries(birthOutcomes.byAttendant)
                    .sort(([, a], [, b]) => b - a)
                    .map(([attendant, count]) => {
                      const pct = birthOutcomes.totalBirths > 0 ? Math.round((count / birthOutcomes.totalBirths) * 100) : 0;
                      const color = attendant === 'doctor' ? 'var(--accent-primary)' : attendant === 'midwife' ? '#EC4899' : attendant === 'nurse' ? 'var(--accent-primary)' : '#FB923C';
                      return (
                        <div key={attendant}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{attendant}</span>
                            <span className="font-bold" style={{ color }}>{count} ({pct}%)</span>
                          </div>
                          <div className="h-3 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Monthly trend */}
            <div className="card-elevated">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Monthly Birth Trend</h3>
              </div>
              <div className="p-4">
                <div className="flex items-end gap-3" style={{ height: '160px' }}>
                  {(birthOutcomes.monthlyTrend || []).map(m => {
                    const monthlyBirthValues = (birthOutcomes.monthlyTrend || []).map(t => t.births);
                    const maxBirths = monthlyBirthValues.length > 0 ? Math.max(...monthlyBirthValues, 1) : 1;
                    const height = (m.births / maxBirths) * 100;
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-center">
                          <p className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>{m.births}</p>
                          <p className="text-[8px]" style={{ color: '#A855F7' }}>{m.caesarean} C/S</p>
                        </div>
                        <div className="w-full flex flex-col justify-end" style={{ height: '120px' }}>
                          <div className="w-full rounded-t-md" style={{
                            height: `${height}%`,
                            minHeight: m.births > 0 ? '4px' : '0',
                            background: 'linear-gradient(180deg, #1B9AAA, rgba(0,119,215,0.3))',
                          }} />
                        </div>
                        <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{m.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* By state */}
            <div className="card-elevated overflow-hidden">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Birth Outcomes by State</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Total Births</th>
                    <th>Caesarean</th>
                    <th>C/S Rate</th>
                    <th>Low Birth Weight</th>
                    <th>LBW Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(birthOutcomes.byState)
                    .filter(([, d]) => d.total > 0)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([state, d]) => (
                      <tr key={state}>
                        <td className="font-medium text-sm">{state}</td>
                        <td className="font-semibold">{d.total}</td>
                        <td>{d.caesarean}</td>
                        <td>
                          <span style={{ color: d.total > 0 && (d.caesarean / d.total * 100) > 15 ? '#FB923C' : 'var(--text-secondary)' }}>
                            {d.total > 0 ? Math.round((d.caesarean / d.total) * 100) : 0}%
                          </span>
                        </td>
                        <td>{d.lowBW}</td>
                        <td>
                          <span style={{ color: d.total > 0 && (d.lowBW / d.total * 100) > 15 ? '#F87171' : 'var(--text-secondary)' }}>
                            {d.total > 0 ? Math.round((d.lowBW / d.total) * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ MORTALITY TAB ═══ */}
        {activeTab === 'mortality' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Maternal Mortality Detail */}
              <div className="card-elevated">
                <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Heart className="w-4 h-4" style={{ color: '#F87171' }} />
                    Maternal Mortality Analysis
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  {/* MMR by age group */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>By Age Group</p>
                    <div className="space-y-2">
                      {Object.entries(maternalMortality.byAgeGroup).map(([age, count]) => {
                        const ageGroupValues = Object.values(maternalMortality.byAgeGroup || {});
                        const maxCount = ageGroupValues.length > 0 ? Math.max(...ageGroupValues, 1) : 1;
                        return (
                          <div key={age} className="flex items-center gap-2">
                            <span className="text-xs w-12 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{age}</span>
                            <div className="flex-1 h-3 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                              <div className="h-full rounded-full" style={{
                                width: `${(count / maxCount) * 100}%`,
                                background: '#F87171',
                                minWidth: count > 0 ? '4px' : '0',
                              }} />
                            </div>
                            <span className="text-xs font-bold w-6" style={{ color: 'var(--text-primary)' }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Monthly trend */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Monthly Trend</p>
                    <div className="flex items-end gap-2" style={{ height: '100px' }}>
                      {maternalMortality.trend.map(t => {
                        const trendValues = (maternalMortality.trend || []).map(tr => tr.deaths);
                        const maxDeaths = trendValues.length > 0 ? Math.max(...trendValues, 1) : 1;
                        const height = (t.deaths / maxDeaths) * 100;
                        return (
                          <div key={t.month} className="flex-1 flex flex-col items-center gap-0.5 group">
                            <span className="text-[8px] opacity-0 group-hover:opacity-100 font-bold" style={{ color: '#F87171' }}>{t.deaths}</span>
                            <div className="w-full flex flex-col justify-end" style={{ height: '70px' }}>
                              <div className="w-full rounded-t-sm" style={{
                                height: `${height}%`,
                                minHeight: t.deaths > 0 ? '3px' : '0',
                                background: '#F87171',
                              }} />
                            </div>
                            <span className="text-[7px] font-mono" style={{ color: 'var(--text-muted)' }}>{t.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Child Mortality Detail */}
              <div className="card-elevated">
                <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Baby className="w-4 h-4" style={{ color: '#5CB8A8' }} />
                    Child Mortality Analysis
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  {/* By gender */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Under-5 by Gender</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-md text-center" style={{ background: 'rgba(56,189,248,0.08)' }}>
                        <p className="text-xl font-bold" style={{ color: '#5CB8A8' }}>{neonatalData.byGender?.Male || 0}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Male</p>
                      </div>
                      <div className="p-3 rounded-md text-center" style={{ background: 'rgba(236,72,153,0.08)' }}>
                        <p className="text-xl font-bold" style={{ color: '#EC4899' }}>{neonatalData.byGender?.Female || 0}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Female</p>
                      </div>
                    </div>
                  </div>

                  {/* Top causes (larger) */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Top Under-5 Causes of Death</p>
                    <div className="space-y-2">
                      {(neonatalData.topCauses || []).slice(0, 6).map((c, i) => {
                        const topCauseValues = (neonatalData.topCauses || []).map(t => t.count);
                        const maxCount = topCauseValues.length > 0 ? Math.max(...topCauseValues, 1) : 1;
                        return (
                          <div key={c.cause}>
                            <div className="flex justify-between text-xs mb-1">
                              <span style={{ color: 'var(--text-secondary)' }}>{c.cause}</span>
                              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{c.count}</span>
                            </div>
                            <div className="h-2 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                              <div className="h-full rounded-full" style={{
                                width: `${(c.count / maxCount) * 100}%`,
                                background: i === 0 ? '#F87171' : i < 3 ? '#FB923C' : 'var(--color-warning)',
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* By state table */}
            <div className="card-elevated overflow-hidden">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Mortality by State</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Maternal Deaths</th>
                    <th>Births</th>
                    <th>MMR /100k</th>
                    <th>Neonatal</th>
                    <th>Infant</th>
                    <th>Under-5</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(maternalMortality.byState)
                    .sort(([, a], [, b]) => b.mmr - a.mmr)
                    .map(([state, d]) => {
                      const neo = neonatalData.byState?.[state];
                      return (
                        <tr key={state}>
                          <td className="font-medium text-sm">{state}</td>
                          <td style={{ color: d.deaths > 0 ? '#F87171' : 'var(--text-secondary)' }}>{d.deaths}</td>
                          <td>{d.births}</td>
                          <td>
                            <span className="font-bold" style={{
                              color: d.mmr > 500 ? '#F87171' : d.mmr > 200 ? 'var(--color-warning)' : 'var(--color-success)',
                            }}>{d.mmr.toLocaleString()}</span>
                          </td>
                          <td>{neo?.neonatal || 0}</td>
                          <td>{neo?.infant || 0}</td>
                          <td>{neo?.under5 || 0}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ IMMUNIZATION TAB ═══ */}
        {activeTab === 'immunization' && (
          <div className="space-y-4">
            <div className="card-elevated overflow-hidden">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Syringe className="w-4 h-4" style={{ color: '#A855F7' }} />
                  Vaccine Coverage & Dropout Analysis
                </h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vaccine</th>
                    <th>Target Pop.</th>
                    <th>Vaccinated</th>
                    <th>Coverage</th>
                    <th>Gap</th>
                    <th>Dropout</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {immunizationGaps.map(gap => {
                    const color = gap.coverageRate >= 80 ? 'var(--color-success)' : gap.coverageRate >= 50 ? 'var(--color-warning)' : '#F87171';
                    return (
                      <tr key={gap.vaccine}>
                        <td className="font-medium text-sm">{gap.vaccine}</td>
                        <td>{gap.targetPopulation}</td>
                        <td className="font-semibold">{gap.vaccinated}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--overlay-light)', maxWidth: '60px' }}>
                              <div className="h-full rounded-full" style={{ width: `${gap.coverageRate}%`, background: color }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color }}>{gap.coverageRate}%</span>
                          </div>
                        </td>
                        <td style={{ color: '#FB923C' }}>{gap.gap}</td>
                        <td>
                          {gap.dropoutRate > 0 ? (
                            <span style={{ color: gap.dropoutRate > 20 ? '#F87171' : '#FB923C' }}>{gap.dropoutRate}%</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {gap.coverageRate >= 80 ? (
                            <span className="badge badge-normal text-[10px]">On Track</span>
                          ) : gap.coverageRate >= 50 ? (
                            <span className="badge badge-warning text-[10px]">Below Target</span>
                          ) : (
                            <span className="badge badge-emergency text-[10px]">Critical Gap</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* By state heatmap */}
            <div className="card-elevated">
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Immunization Coverage by State</h3>
              </div>
              <div className="p-4 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>State</th>
                      {immunizationGaps.map(g => (
                        <th key={g.vaccine} className="text-center">{g.vaccine}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SOUTH_SUDAN_STATES.map(state => (
                      <tr key={state}>
                        <td className="font-medium text-xs whitespace-nowrap">{state.replace('Northern ', 'N. ').replace('Western ', 'W. ').replace('Eastern ', 'E. ').replace('Central ', 'C. ')}</td>
                        {immunizationGaps.map(g => {
                          const stateData = g.byState?.[state];
                          const rate = stateData?.rate || 0;
                          const color = rate >= 80 ? 'var(--color-success)' : rate >= 50 ? 'var(--color-warning)' : rate > 0 ? '#F87171' : 'var(--text-muted)';
                          return (
                            <td key={g.vaccine} className="text-center">
                              <span className="text-xs font-bold" style={{ color }}>{rate}%</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ HIGH RISK TAB ═══ */}
        {activeTab === 'high-risk' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card-elevated p-4">
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total High Risk</p>
                <p className="text-2xl font-bold" style={{ color: '#F87171' }}>
                  {highRiskPregnancies.filter(h => h.riskLevel === 'high').length}
                </p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Moderate Risk</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>
                  {highRiskPregnancies.filter(h => h.riskLevel === 'moderate').length}
                </p>
              </div>
              <div className="card-elevated p-4">
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Tracked</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>
                  {highRiskPregnancies.length}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {highRiskPregnancies.map(mother => {
                const isHigh = mother.riskLevel === 'high';
                const color = isHigh ? '#F87171' : 'var(--color-warning)';
                const isExpanded = expandedMother === mother.motherId;
                return (
                  <div key={mother.motherId} className="card-elevated overflow-hidden">
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedMother(isExpanded ? null : mother.motherId)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{
                          background: `${color}12`,
                          border: `1px solid ${color}20`,
                        }}>
                          <HeartPulse className="w-5 h-5" style={{ color }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{mother.motherName}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                              background: `${color}15`,
                              color,
                            }}>{mother.riskLevel.toUpperCase()}</span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Age {mother.age} &middot; {mother.gestationalAge}w GA &middot; {mother.visitCount} visits &middot; {mother.facility}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{mother.state}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Last: {mother.lastVisitDate}</p>
                        </div>
                        {isExpanded ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Blood Pressure</p>
                            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{mother.bloodPressure}</p>
                          </div>
                          <div className="p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Hemoglobin</p>
                            <p className="text-sm font-bold mt-0.5" style={{
                              color: mother.hemoglobin < 11 ? '#F87171' : 'var(--color-success)',
                            }}>{mother.hemoglobin} g/dL</p>
                          </div>
                          <div className="p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Gestational Age</p>
                            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{mother.gestationalAge} weeks</p>
                          </div>
                          <div className="p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Visit Count</p>
                            <p className="text-sm font-bold mt-0.5" style={{
                              color: mother.visitCount >= 4 ? 'var(--color-success)' : 'var(--color-warning)',
                            }}>{mother.visitCount}</p>
                          </div>
                        </div>
                        {(mother.riskFactors?.length ?? 0) > 0 && (
                          <div className="mt-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Risk Factors</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(mother.riskFactors || []).map(rf => (
                                <span key={rf} className="text-[10px] px-2 py-0.5 rounded-full" style={{
                                  background: `${color}10`,
                                  color,
                                  border: `1px solid ${color}20`,
                                }}>{rf}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {highRiskPregnancies.length === 0 && (
                <div className="card-elevated p-8 text-center">
                  <HeartPulse className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No high-risk pregnancies detected</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
