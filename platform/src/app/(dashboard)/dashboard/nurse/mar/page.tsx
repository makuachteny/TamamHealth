'use client';

import MarWorkflow from '@/components/nurse/MarWorkflow';

export default function NurseMarPage() {
  return (
    <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column' }}>
      <MarWorkflow />
    </main>
  );
}
