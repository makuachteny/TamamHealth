'use client';

/**
 * Super-admin → System Health.
 * Storage-level view of the local PouchDB stores plus the build's stack facts.
 * Platform settings (identity, tenant defaults, maintenance) live on
 * /admin/config — this page deliberately holds no editable configuration.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n/useTranslation';
import EhrListHeader, { LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';
import { SaPage, SaCard, SaTable } from '@/components/admin/sa-ui';

interface DBStats {
  name: string;
  docCount: number;
}

export default function AdminSystemPage() {
  const { t } = useTranslation();

  const [dbStats, setDbStats] = useState<DBStats[]>([]);
  const [dbStatsLoading, setDbStatsLoading] = useState(true);

  // Load DB stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const { getDB } = await import('@/lib/db');
        const dbNames = [
          { key: 'tamamhealth_users', label: t('system.dbUsers') },
          { key: 'tamamhealth_patients', label: t('system.dbPatients') },
          { key: 'tamamhealth_hospitals', label: t('system.dbHospitals') },
          { key: 'tamamhealth_medical_records', label: t('system.dbMedicalRecords') },
          { key: 'tamamhealth_referrals', label: t('system.dbReferrals') },
          { key: 'tamamhealth_lab_results', label: t('system.dbLabResults') },
          { key: 'tamamhealth_disease_alerts', label: t('system.dbDiseaseAlerts') },
          { key: 'tamamhealth_prescriptions', label: t('system.dbPrescriptions') },
          { key: 'tamamhealth_audit_log', label: t('system.dbAuditLog') },
          { key: 'tamamhealth_messages', label: t('system.dbMessages') },
          { key: 'tamamhealth_births', label: t('system.dbBirths') },
          { key: 'tamamhealth_deaths', label: t('system.dbDeaths') },
          { key: 'tamamhealth_immunizations', label: t('system.dbImmunizations') },
          { key: 'tamamhealth_anc', label: t('system.dbAncVisits') },
          { key: 'tamamhealth_follow_ups', label: t('system.dbFollowUps') },
          { key: 'tamamhealth_organizations', label: t('system.dbOrganizations') },
          { key: 'tamamhealth_platform_config', label: t('system.dbPlatformConfig') },
        ];
        // Run all db.info() calls concurrently — sequential awaits across 18
        // databases meant 18 round-trips on every page load.
        const stats: DBStats[] = await Promise.all(
          dbNames.map(async ({ key, label }) => {
            try {
              const db = getDB(key);
              const info = await db.info();
              return { name: label, docCount: info.doc_count };
            } catch {
              return { name: label, docCount: 0 };
            }
          })
        );
        setDbStats(stats);
      } catch (err) {
        console.error('Failed to load DB stats:', err);
      } finally {
        setDbStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  const totalDocs = dbStats.reduce((sum, s) => sum + s.docCount, 0);

  return (
    <SaPage>
      <SaCard>
        <EhrListHeader
          title="System Health"
          stats={[
            { label: t('system.totalDocuments'), value: dbStatsLoading ? '…' : totalDocs, color: LIST_STAT_COLORS.blue },
            { label: 'Databases', value: dbStatsLoading ? '…' : dbStats.length, color: LIST_STAT_COLORS.muted },
          ]}
        />
        <SaTable
          columns={[t('system.database'), t('system.totalDocuments')]}
          empty={dbStatsLoading ? t('system.loadingStats') : undefined}
        >
          {dbStats.map(db => (
            <tr key={db.name}>
              <td>{db.name}</td>
              <td style={{ fontFamily: 'var(--font-platform-mono)', color: db.docCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {db.docCount.toLocaleString()}
              </td>
            </tr>
          ))}
        </SaTable>
      </SaCard>

      <SaCard title={t('system.systemInfo')}>
        <div className="sa-kv">
          {[
            { label: t('system.storageEngine'), value: 'PouchDB (IndexedDB)' },
            { label: t('system.platform'), value: 'Next.js 14' },
            { label: t('system.uiFramework'), value: 'Tailwind CSS' },
            { label: t('system.auth'), value: 'JWT (Client-side)' },
          ].map(item => (
            <div key={item.label} className="sa-kv-row">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      </SaCard>
    </SaPage>
  );
}
