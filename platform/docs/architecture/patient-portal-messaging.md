# Patient-portal ↔ facility messaging

How a message typed in the patient-portal Chat tab reaches the staff inbox,
and how a staff reply gets back to the patient. Half-page contract — read
end-to-end before changing fields.

## The directionality contract

Every persisted message carries an explicit `direction` (see
[`MessageDoc`](../../src/lib/db-types.ts) — the `direction` field):

| `direction`         | sender → recipient                 | written by                                    |
|---------------------|------------------------------------|-----------------------------------------------|
| `patient_to_staff`  | patient (via portal) → facility    | `patient-portal/page.tsx` `handleSendChat`    |
| `staff_to_patient`  | facility → patient                 | `SendMessageModal` (recipient.type=`patient`) |
| `staff_to_staff`    | facility → another staff member    | `SendMessageModal` (recipient.type=`staff`)   |

The field is **optional** for backward compatibility: legacy docs written
before the field existed are treated as `staff_to_patient`, with the
exception that any message whose `fromDoctorId === 'patient'` is
recognised as inbound (this is the marker the patient-portal used before
the directional field landed).

## Canonical fields

Patient-originated messages set:

```ts
{
  direction: 'patient_to_staff',
  recipientType: 'staff',
  patientId:           <the patient's _id>,
  patientName:         "<First> <Surname>",
  patientPhone:        <patient.phone || ''>,
  recipientHospitalId: <patient.registrationHospital>,
  recipientDepartment: <chatDepartment>, // e.g. "General / OPD"
  fromDoctorId:        'patient',                 // sentinel marker
  fromDoctorName:      "<First> <Surname>",       // patient's own name
  fromHospitalId:      <patient.registrationHospital>,
  // ...subject / body / channel / sentAt as usual
}
```

Staff-authored messages keep the same `patientId`/`patientName`/
`patientPhone` triplet (whether the recipient is a patient or another
staff member, by historical contract); `recipientType` discriminates.
The reply path sets `direction: 'staff_to_patient'` and re-uses the
inbound message's `patientId`, so `getMessagesByPatient(patientId)`
returns the full conversation.

## Sync topology

The patient-portal runs in the patient's browser against a local PouchDB
named `tamamhealth_messages`. In a synced deployment, that PouchDB has
two-way replication configured against the facility's CouchDB (see
`src/lib/db.ts` for the channel setup). The flow is:

```
[Patient browser]                [Facility CouchDB]              [Staff browser]
PouchDB (messages)  --bi-sync--> CouchDB (messages)  --bi-sync--> PouchDB (messages)
        ^                                                                 |
        | createMessage(direction='patient_to_staff')                     |
        |                                                                 v
   patient-portal Chat tab                                          /messages page
        ^                                                                 |
        | createMessage(direction='staff_to_patient')                     |
        +-----------------------------------------------------------------+
```

Both ends live-subscribe to changes via `db.changes({ since: 'now',
live: true })` so a delivered message lights up the other side without a
manual refresh. In offline / local-only deployments the message still
survives reloads on the device that wrote it; once a sync target comes
online the existing replication picks the docs up.

## Helpers (in [`message-service.ts`](../../src/lib/services/message-service.ts))

- `getMessagesByPatient(patientId)` — full conversation for one patient,
  newest-first. Used by both the patient portal Chat tab and the staff
  reply path.
- `getInboundPatientMessages(scope?)` — the staff Inbox "From Patients"
  filter. Matches `direction === 'patient_to_staff'` _or_ the legacy
  `fromDoctorId === 'patient'` marker.
- `getMessagesForFacility(hospitalId, scope?)` — every message routed to
  or from a given facility, by `recipientHospitalId` or `fromHospitalId`.
  Useful for facility-scoped dashboards that aren't already running with
  a `DataScope` filter.

## Why we don't repurpose `recipientType`

`recipientType` answers _"is the recipient a patient or a staff member?"_
which is orthogonal to direction. A `patient_to_staff` message has
`recipientType: 'staff'`, but so does a staff-to-staff message. The two
fields together unambiguously type each row, and existing UI that filters
on `recipientType` keeps working.
