'use client';

import HandoffWorkflow from '@/components/nurse/HandoffWorkflow';

export default function NurseHandoffPage() {
  return (
    <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column' }}>
      <HandoffWorkflow variant="page" />
    </main>
  );
}
