'use client';

/**
 * Clinical notes queue — every note the signed-in clinician can see, across
 * patients.
 *
 * Defaults to their own unsigned notes, because the reason to open this screen
 * is almost always "what have I not finished documenting". The filters widen it
 * from there.
 */

import { useMemo } from 'react';
import EhrListHeader from '@/components/ehr/EhrListHeader';
import NotesList from '@/components/clinical-notes/NotesList';
import { useApp } from '@/lib/context';
import { useUsers } from '@/lib/hooks/useUsers';

export default function ClinicalNotesQueuePage() {
  const { currentUser } = useApp();
  const { users } = useUsers();

  const assignable = useMemo(
    () => (users || []).map(u => ({ _id: u._id, name: u.name || u.username })),
    [users],
  );

  return (
    <div className="ehr-page">
      <EhrListHeader title="Clinical Notes" />
      <div style={{ padding: '0 4px' }}>
        <NotesList
          currentUser={currentUser}
          users={assignable}
          showCreate={false}
        />
      </div>
    </div>
  );
}
