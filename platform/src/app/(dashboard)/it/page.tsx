'use client';

/**
 * Standalone IT Operations page. The console itself lives in
 * ItOperationsPanel and is also hosted as the "IT Operations" section of
 * /system-admin — this route stays for deep links and roles that keep a
 * dedicated nav entry.
 */

import EhrListHeader from '@/components/ehr/EhrListHeader';
import ItOperationsPanel from '@/components/admin/ItOperationsPanel';

export default function ItOperationsPage() {
  return (
    <main className="page-container page-enter">
      <div className="dash-card overflow-hidden mb-4">
        <EhrListHeader title="IT Operations" />
      </div>
      <ItOperationsPanel />
    </main>
  );
}
