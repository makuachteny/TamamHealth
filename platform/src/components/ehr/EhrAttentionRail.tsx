'use client';

/**
 * "Needs your attention" as a permanent rail beside every module.
 *
 * It used to exist only on the doctor's dashboard, which meant the moment a
 * clinician moved into Pharmacy, Wards, Referrals or Antenatal Care, the list
 * of things waiting on them vanished — the work was still there, just no longer
 * on screen. Anchoring it to the app shell keeps it in the same place in every
 * module, so "what needs me" is a glance rather than a trip home.
 *
 * The card renders even when the feed is empty. A card that disappears teaches
 * a clinician nothing: "all caught up" and "the panel is broken" look identical
 * when both are a blank space, so the quiet state is stated in words.
 *
 * Rows are the notification feed — the same items the bell raises — so the two
 * never disagree about what is outstanding.
 */

import { useRouter } from 'next/navigation';
import { ClipboardCheck } from '@/components/icons/lucide';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { NOTIFICATION_META, SEVERITY_META } from '@/lib/notification-meta';

/** How many rows are kept in the DOM; the rest live on /notifications. */
const MAX_ROWS = 25;

/**
 * The card on its own, for dashboards that already have a right rail and want
 * it sitting with their other cards rather than in a second column.
 */
export function EhrAttentionCard() {
  const router = useRouter();
  const { items, count, loading } = useNotifications();

  return (
      <section className="ehr-side-card ehr-action-feed-card">
        <div className="ehr-side-card-head">
          <ClipboardCheck className="w-5 h-5" />
          <h2>Needs your attention</h2>
        </div>

        {loading ? (
          <p className="ehr-action-empty">Checking what needs you…</p>
        ) : count === 0 ? (
          <p className="ehr-action-empty">All caught up — nothing needs your attention right now.</p>
        ) : (
          <>
            <ul className="ehr-action-feed is-scrollable">
              {items.slice(0, MAX_ROWS).map(item => {
                const meta = NOTIFICATION_META[item.type];
                const severity = SEVERITY_META[item.severity];
                const Icon = meta.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`ehr-action-row is-${item.severity}`}
                      onClick={() => router.push(item.href)}
                      title={`${meta.label} · ${severity.label}`}
                    >
                      {/* Bare icon, no tinted chip: globals.css strips the
                          background off any `span:has(> svg:only-child)`, so the
                          glyph carries the source colour on its own. */}
                      <span className="ehr-action-icon">
                        {/* The icon set hardcodes a stroke attribute, so the
                            colour must be forced via the stroke property. */}
                        <Icon className="w-3.5 h-3.5" style={{ stroke: meta.color, color: meta.color }} />
                      </span>
                      <span className="ehr-action-text">
                        <span className="ehr-action-title">{item.title}</span>
                        <span className="ehr-action-meta">{item.subtitle}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="ehr-action-more" onClick={() => router.push('/notifications')}>
              {`View all ${count} in notifications`}
            </button>
          </>
        )}
      </section>
  );
}

/**
 * The rail the app shell renders for every module that has no right-hand
 * column of its own — the card in its own aside so it lines up with where the
 * dashboards keep theirs.
 */
export default function EhrAttentionRail() {
  return (
    <aside className="ehr-global-rail no-print" aria-label="Needs your attention">
      <EhrAttentionCard />
    </aside>
  );
}
