'use client';

/**
 * Programs tab content — this app has no care-program enrollment data model
 * (grepped for Program/Enrollment concepts: the only hit was an unrelated
 * `payorInfo.programEnrollment` string used for insurance/NGO coverage at
 * registration, not a clinical program like ART/TB/PMTCT). Per the Stage 3
 * brief, we do NOT invent an enrollment store in this pass — this is a
 * faithful OpenMRS empty state with the action rendered as a disabled
 * "coming soon" note rather than a link to a flow that doesn't exist.
 */

import ChartSection, { OmrsEmptyState } from '../ChartSection';

export default function ProgramsSection() {
  return (
    <ChartSection title="Programs">
      <OmrsEmptyState
        itemLabel="program enrollments"
        actionLabel="Record program enrollment"
        disabledReason="Program enrollment isn't built yet — coming soon"
      />
    </ChartSection>
  );
}
