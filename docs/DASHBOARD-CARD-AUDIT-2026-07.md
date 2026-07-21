# Dashboard Card Audit — repetition, dead weight, and data-flow review

**Date:** 2026-07-21
**Method:** every sidebar card, metric, tab, filter, checklist and mission block on every role
dashboard traced to its exact derivation in code, then judged on one question: *does this number
drive a decision this role makes today?* Set relationships verified (subset / duplicate / dead).

## The pattern

The shared shell makes metrics, checklists and mission cards cheap to add — so every role
accumulated **three projections of the same numbers**: a tab count, a sidebar metric, and a
checklist item that is `done` when the count hits zero. Pharmacy's Pending appears 3×; radiology's
Pending/In Progress/Complete appear 3×; the doctor's outstanding counts render twice on one screen.
Every role's mission card is static filler. Checklists trend toward restating counts instead of
tracking work.

## Front desk — "Reception today"

Set relationships: **Waiting ⊂ Live queue**, **Walk-ins ⊂ Live queue**, **Completed ⊂ Live queue**;
**Today's appointments ⊇ Pending arrivals**; Walk-ins metric ≡ Walk-ins tab (same expression);
All tab ≡ Live queue + Pending arrivals.

| Element | Verdict |
|---|---|
| Today's appointments | **KEEP** — the book of the day |
| Pending arrivals | **KEEP** — "who do I check in next?" |
| Live queue | **KEEP** — the working set |
| Waiting | **MERGE** into Live queue (subset; also restated by "Assign provider" checklist) |
| Walk-ins metric | **REMOVE** — identical to the Walk-ins tab |
| Completed | **MERGE** — subset of Live queue; restated by "Close completed visits" |
| Registered patients | **RELOCATE** — all-time registry count on a "today" card |
| Referrals tab | **REMOVE** — permanently 0; no code path creates a referral queue entry |
| Checklist "Register patient" | **REMOVE** — reduces to `patients.length>0`, always done |
| Checklist "Check in arrivals" / "Assign provider" / "Close completed" | **MERGE** — boolean restatements of the metrics above |
| Checklist "Room walk-ins" | **KEEP** — only unique signal in the checklist |
| ActionStrip "Check-in queue" | **REMOVE** — same handler as the "Check in" action |

## Doctor

| Element | Verdict |
|---|---|
| Outstanding: Documents to sign / Phone notes / Awaiting labs / Telehealth | **KEEP** |
| Outstanding: Open referrals | **FIX** — counts *all* referrals I created, not open ones; filter to pending or rename |
| Outstanding: Patient intake | **REMOVE** — synthetic `min(assigned,4)` count, no real signal |
| Outstanding chips duplicated in the daybar | **REMOVE** the daybar copy — same 6 counts twice per screen |
| Daybar "Scheduled"/"In Office" | **REMOVE** — the queue table's Status column shows this per row |
| Tamam checklist (all 5 items) | **REMOVE** — Medication plan is hardcoded `done:true`, Charge draft is near-always true, the rest mirror Outstanding counts |
| Mission "Direct care first" | **REMOVE** — static filler |

## Nurse

| Element | Verdict |
|---|---|
| Critical / Urgent metrics | **KEEP** — acuity drives the shift |
| Patients / Active admissions / Triage today metrics | **MERGE** — echo the Ward/MAR/Triage tab counts |
| Handoff tab count | **REMOVE** the count — hardcoded 0 |
| Checklist "Medication administration" / "Shift handoff" | **REMOVE** — `done` = "currently viewing that tab" (navigation state, not work) |
| Checklist "Review assigned patients" | **REMOVE** — done only when zero patients exist |
| Mission "Bedside care" | **REMOVE** — filler |

## Pharmacy

| Element | Verdict |
|---|---|
| Payment due / Ready / Low Stock / Critical Stock | **KEEP** — the real decisions |
| Pending Rx / Dispensed / Controlled metrics | **MERGE** — same numbers as the tabs |
| Checklist PENDING / CONTROLLED | **MERGE** — duplicate the tabs a third time |
| Checklist RECEIVE STOCK | **KEEP** — real stock trigger |
| Mission | **REMOVE** — restates the page title |

## Lab

| Element | Verdict |
|---|---|
| Abnormal / Critical metrics + "Critical result" checklist (unacknowledged) | **KEEP** — the safety core |
| Pending / Processing / Complete metrics | **MERGE** — duplicate the tabs |
| Specimen pipeline / Results metrics | **MERGE** — duplicate View-all / Complete |
| Checklist "Enter result" | **MERGE** — duplicates Pending |
| Checklist "Batch entry" | **REMOVE** — nonsensical done-condition |
| Mission | **REMOVE** |

## Radiology

| Element | Verdict |
|---|---|
| Status filters (Pending / In Progress / Complete) | **KEEP** — the primary control |
| Same three as metrics AND as checklist | **REMOVE** — triplicated |
| Urgent / X-rays / Ultrasounds | **KEEP** — modality & acuity mix |
| `avgTAT: '45 min'` | **REMOVE** — hardcoded constant presented as a KPI |
| Performance "Total patients" / "Lab cross-refs" | **RELOCATE** — all-time totals on a day view |
| Mission | **REMOVE** |

## Nutrition / HR / Data entry / State / Facility management

- **Nutrition:** the 5 sidebar filters and the first 5 metrics are byte-identical — keep one set.
  SAM/MAM counts are all-time (and demo-inflated), so they can't drive today's triage — scope to
  today/this week. "New screening" checklist item (`done: total>0`) is meaningless.
- **HR:** pending-leave count appears 3× (tab, KPI, checklist). "Present today" is the keeper.
  The checklist is nav links dressed as tasks; payroll is hardcoded never-done.
- **Data entry:** the best card in the app — one real checklist item ("today's census filed?") and
  three live metrics. Remove the static Beds/Doctors/Nurses profile tiles.
- **State:** verify "Immunizations YTD" — the value looks all-time. Tab count duplicates the
  mission's county count.
- **Facility management:** "Reviews Score" chart title is reference-template residue over real
  activity data; the per-row "Facility Inbox" count repeats the same global number on all 6 rows;
  the enquiries status pill is hardcoded green.
- **Shell:** the row-detail "Financial" tab renders hardcoded `—` / "Not started" placeholders for
  every role — hide it until billing data is wired.

## Data-flow findings (real-life lens)

1. **Two queue engines disagree.** Front desk hand-rolls its queue (WAITING/IN CONSULT/DONE) while
   the doctor's worklist uses the canonical stage-based `buildQueueFromTriage`. Reception cannot
   see awaiting-lab/pharmacy states, so a patient "done" at reception may still be mid-visit.
   → Port the front-desk queue onto `patient-queue-service` so both roles read one truth.
2. **Terminal-status asymmetry:** appointment checkouts are reversible, triage checkouts write
   terminal `discharged`; the Completed count mixes both with no distinction.
3. **"Open referrals" mislabels an all-time count** — a doctor sees "1" forever after any referral.
4. **Vanity vs action:** the numbers that survive this audit are the ones a role acts on within the
   hour (pending arrivals, acuity split, unacknowledged criticals, stock-outs, unpaid dispenses,
   census-filed). Everything cut is scoreboard.
