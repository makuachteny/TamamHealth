'use client';

/**
 * ChartVitalsBand — sticky "Vitals and biometrics" band directly under the
 * patient header. Reads from the already-computed `latestVitals` (the most
 * recent medical record's vitalSigns) — no new data fetching here.
 */

import { Info } from '@/components/icons/lucide';
import { formatDateTime } from '@/lib/format-utils';

// Loosely typed — mirrors data/mock.ts VitalSigns, but every field is read
// defensively since records may have partial vitals.
type VitalsLike = Partial<{
  temperature: number;
  systolic: number;
  diastolic: number;
  pulse: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  weight: number;
  height: number;
  bmi: number;
}>;

function fmt(value: number | undefined | null, unit: string): { value: string; unit: string } {
  if (value === undefined || value === null || Number.isNaN(value) || value === ('' as unknown)) {
    return { value: '--', unit: '' };
  }
  return { value: String(value), unit };
}

interface ChartVitalsBandProps {
  latestVitals: VitalsLike | undefined;
  latestRecordDate?: string;
  onViewVitalsHistory: () => void;
  onRecordVitals: () => void;
  canRecordVitals: boolean;
}

export default function ChartVitalsBand({
  latestVitals, latestRecordDate, onViewVitalsHistory, onRecordVitals, canRecordVitals,
}: ChartVitalsBandProps) {
  const recordTs = latestRecordDate ? new Date(latestRecordDate).getTime() : NaN;
  const hoursOld = Number.isNaN(recordTs) ? null : (Date.now() - recordTs) / 3600000;
  const isStale = hoursOld !== null && hoursOld > 16;
  let freshnessLabel = '';
  if (isStale && hoursOld !== null) {
    const days = Math.floor(hoursOld / 24);
    freshnessLabel = days >= 1
      ? `${days} day${days === 1 ? '' : 's'} old`
      : `${Math.floor(hoursOld)} hour${Math.floor(hoursOld) === 1 ? '' : 's'} old`;
  }

  const bmi = latestVitals?.bmi ?? (
    latestVitals?.weight && latestVitals?.height
      ? Number((latestVitals.weight / ((latestVitals.height / 100) ** 2)).toFixed(1))
      : undefined
  );

  const bp = latestVitals?.systolic && latestVitals?.diastolic
    ? { value: `${latestVitals.systolic}/${latestVitals.diastolic}`, unit: 'mmHg' }
    : { value: '--', unit: '' };

  const cells = [
    { label: 'BP', ...bp },
    { label: 'Heart rate', ...fmt(latestVitals?.pulse, 'beats/min') },
    { label: 'R. rate', ...fmt(latestVitals?.respiratoryRate, 'breaths/min') },
    { label: 'SpO2', ...fmt(latestVitals?.oxygenSaturation, '%') },
    { label: 'Temp', ...fmt(latestVitals?.temperature, '°C') },
    { label: 'Weight', ...fmt(latestVitals?.weight, 'kg') },
    { label: 'Height', ...fmt(latestVitals?.height, 'cm') },
    { label: 'BMI', ...fmt(bmi, 'kg/m²') },
  ];

  return (
    <div className="omrs-vitals-band">
      <div className="omrs-vitals-head">
        <span className="omrs-vitals-title">Vitals and biometrics</span>
        {latestRecordDate && <span className="omrs-vitals-timestamp">{formatDateTime(latestRecordDate)}</span>}
        {isStale && <span className="omrs-vitals-fresh-pill">These vitals are {freshnessLabel}</span>}
        <button type="button" className="omrs-vitals-link" onClick={onViewVitalsHistory}>Vitals history</button>
        <span className="omrs-vitals-info" title="Latest recorded vital signs for this patient">
          <Info />
        </span>
        <span className="omrs-vitals-spacer" />
        <button type="button" className="omrs-vitals-record-link" onClick={onRecordVitals}>
          Record vitals {canRecordVitals ? '→' : ''}
        </button>
      </div>
      <div className="omrs-vitals-grid">
        {cells.map(cell => (
          <div className="omrs-vitals-cell" key={cell.label}>
            <div className="omrs-vitals-label">{cell.label}</div>
            <div className="omrs-vitals-value">
              {cell.value}
              {cell.unit && <span className="omrs-vitals-unit">{cell.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
