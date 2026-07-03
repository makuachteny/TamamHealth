"use client";

import { useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   Platform workflow player — a clickable walkthrough of each product's
   real workflow, rendered as a mock platform screen (flat clinical
   style: white panel, hairline borders, solid navy header bar).

   Clicking the primary action on the mock screen advances to the next
   step; the stepper chips jump anywhere; the last action replays.
   ═══════════════════════════════════════════════════════════════════ */

interface WorkflowRow {
  k: string;
  v: string;
  tone?: "ok" | "warn";
}

interface WorkflowStep {
  label: string;   // stepper chip
  screen: string;  // mock window title
  rows: WorkflowRow[];
  action: string;  // primary button — advances the workflow
}

const WORKFLOWS: Record<string, WorkflowStep[]> = {
  hospital: [
    {
      label: "Register",
      screen: "Front Desk · New Patient",
      rows: [
        { k: "Patient", v: "Nyibol Atem · F · 23y" },
        { k: "Hospital No.", v: "WSH-000031 (auto)" },
        { k: "Geocode", v: "Wau · BOMA-04" },
        { k: "Household", v: "Linked · HH-2213", tone: "ok" },
      ],
      action: "Send to triage",
    },
    {
      label: "Triage",
      screen: "Triage Station · Queue 3 of 7",
      rows: [
        { k: "BP", v: "128 / 84 mmHg" },
        { k: "Temp", v: "38.6 °C", tone: "warn" },
        { k: "Priority", v: "YELLOW", tone: "warn" },
        { k: "Chief complaint", v: "Fever, 3 days" },
      ],
      action: "Route to consultation",
    },
    {
      label: "Consult",
      screen: "Consultation · SOAP Note",
      rows: [
        { k: "Assessment", v: "Suspected malaria" },
        { k: "Note", v: "AI-assisted SOAP draft" },
        { k: "Orders", v: "Malaria RDT + Hb" },
        { k: "History", v: "2 prior visits on record", tone: "ok" },
      ],
      action: "Send lab order",
    },
    {
      label: "Lab",
      screen: "Laboratory · Result Entry",
      rows: [
        { k: "Malaria RDT", v: "Positive", tone: "warn" },
        { k: "Hb", v: "10.2 g/dL" },
        { k: "Validated by", v: "Lab Tech · G. Puok", tone: "ok" },
        { k: "Turnaround", v: "22 min", tone: "ok" },
      ],
      action: "Prescribe treatment",
    },
    {
      label: "Pharmacy",
      screen: "Pharmacy · Dispense e-Rx",
      rows: [
        { k: "Rx", v: "Coartem 20/120 · 3 days" },
        { k: "Batch", v: "B-0421 · exp 03/27", tone: "ok" },
        { k: "Payment", v: "Mobile money · SSP 1,200", tone: "ok" },
        { k: "Stock", v: "Auto-decremented" },
      ],
      action: "Complete visit",
    },
    {
      label: "Report",
      screen: "Facility Dashboard · Tonight",
      rows: [
        { k: "Encounter", v: "Synced offline → cloud", tone: "ok" },
        { k: "HMIS 105", v: "Auto-tallied", tone: "ok" },
        { k: "DHIS2", v: "Queued for monthly push" },
        { k: "Ward occupancy", v: "61%" },
      ],
      action: "Replay workflow",
    },
  ],

  clinic: [
    {
      label: "Register",
      screen: "Reception · Walk-in",
      rows: [
        { k: "Patient", v: "Deng Wol · M · 41y" },
        { k: "Photo + geocode", v: "Captured", tone: "ok" },
        { k: "Time to register", v: "84 seconds", tone: "ok" },
        { k: "Visit type", v: "Outpatient" },
      ],
      action: "Start visit",
    },
    {
      label: "Vitals",
      screen: "Nurse Station · Vitals",
      rows: [
        { k: "BP", v: "142 / 95 mmHg", tone: "warn" },
        { k: "Weight", v: "78 kg" },
        { k: "Complaint", v: "Headache, dizziness" },
        { k: "Flag", v: "Hypertension review", tone: "warn" },
      ],
      action: "Open consultation",
    },
    {
      label: "Consult",
      screen: "Consultation · Template",
      rows: [
        { k: "Template", v: "Hypertension review" },
        { k: "Assessment", v: "Stage 1 HTN" },
        { k: "Plan", v: "Amlodipine 5mg OD" },
        { k: "Offline", v: "Note saved locally", tone: "ok" },
      ],
      action: "Create prescription",
    },
    {
      label: "Dispense",
      screen: "Dispensary · Formulary",
      rows: [
        { k: "Drug", v: "Amlodipine 5mg × 30" },
        { k: "Dose check", v: "Weight-based · OK", tone: "ok" },
        { k: "Interactions", v: "None found", tone: "ok" },
        { k: "Stock after", v: "112 tabs" },
      ],
      action: "Collect payment",
    },
    {
      label: "Close",
      screen: "Billing · Day Close",
      rows: [
        { k: "Payment", v: "MTN MoMo · SSP 800", tone: "ok" },
        { k: "Follow-up", v: "SMS reminder in 30 days" },
        { k: "Daily reconciliation", v: "Balanced", tone: "ok" },
        { k: "HMIS", v: "Auto-built from visits" },
      ],
      action: "Replay workflow",
    },
  ],

  lab: [
    {
      label: "Order",
      screen: "Order Intake · From OPD",
      rows: [
        { k: "Patient", v: "Ayen Achuil · F · 29y" },
        { k: "Tests", v: "Malaria RDT · Hb · WBC" },
        { k: "Ordered by", v: "CO Deng Mabior" },
        { k: "Priority", v: "Routine" },
      ],
      action: "Print barcode label",
    },
    {
      label: "Collect",
      screen: "Phlebotomy · Accession",
      rows: [
        { k: "Specimen", v: "Blood · EDTA" },
        { k: "Barcode", v: "LAB-2026-0847", tone: "ok" },
        { k: "Accessioned", v: "09:42 AM" },
        { k: "Chain", v: "Collection → bench tracked", tone: "ok" },
      ],
      action: "Start bench work",
    },
    {
      label: "Result",
      screen: "Bench · Result Capture",
      rows: [
        { k: "Malaria RDT", v: "Positive", tone: "warn" },
        { k: "Hb", v: "8.7 g/dL — below range", tone: "warn" },
        { k: "QC", v: "Westgard rules pass", tone: "ok" },
        { k: "Range check", v: "SS pediatric bands applied" },
      ],
      action: "Validate result",
    },
    {
      label: "Alert",
      screen: "Critical Values · Auto-flag",
      rows: [
        { k: "Flag", v: "Hb critical-low", tone: "warn" },
        { k: "SMS to clinician", v: "Sent in 38 seconds", tone: "ok" },
        { k: "Acknowledged", v: "CO Deng Mabior", tone: "ok" },
        { k: "Escalation", v: "Not needed" },
      ],
      action: "Release to clinician",
    },
    {
      label: "Release",
      screen: "TAT Dashboard · Today",
      rows: [
        { k: "Released to", v: "Encounter · one click", tone: "ok" },
        { k: "TAT this order", v: "31 min", tone: "ok" },
        { k: "Median TAT (shift)", v: "27 min" },
        { k: "Offline queue", v: "0 pending sync", tone: "ok" },
      ],
      action: "Replay workflow",
    },
  ],

  radiology: [
    {
      label: "Schedule",
      screen: "Scheduling · Ultrasound",
      rows: [
        { k: "Patient", v: "Abuk Deng · F · 32y" },
        { k: "Study", v: "Obstetric US · 2nd trimester" },
        { k: "Slot", v: "Tomorrow 10:30 AM" },
        { k: "Prep warnings", v: "Full bladder — SMS sent", tone: "ok" },
      ],
      action: "Send to worklist",
    },
    {
      label: "Acquire",
      screen: "Modality Worklist · US-1",
      rows: [
        { k: "Worklist", v: "Patient auto-populated", tone: "ok" },
        { k: "Images", v: "14 acquired" },
        { k: "Radiographer", v: "L. Soro" },
        { k: "Status", v: "Study complete" },
      ],
      action: "Push to PACS",
    },
    {
      label: "Report",
      screen: "Reporting · Structured Template",
      rows: [
        { k: "Template", v: "OB ultrasound · 2nd tri" },
        { k: "Prior study", v: "Compared · 8 weeks ago", tone: "ok" },
        { k: "Findings", v: "Normal growth, EFW 45th %ile" },
        { k: "Reading from", v: "Juba (remote)", tone: "ok" },
      ],
      action: "Sign report",
    },
    {
      label: "Deliver",
      screen: "Delivery · Ordering Clinician",
      rows: [
        { k: "Report PDF", v: "In encounter", tone: "ok" },
        { k: "SMS notify", v: "Sent to midwife", tone: "ok" },
        { k: "Patient copy", v: "CD/USB export ready" },
        { k: "Turnaround", v: "Same day", tone: "ok" },
      ],
      action: "View patient history",
    },
    {
      label: "History",
      screen: "Imaging History · One Record",
      rows: [
        { k: "Prior studies", v: "3 · one click away", tone: "ok" },
        { k: "PACS", v: "Orthanc · no lock-in" },
        { k: "Next visit", v: "Follow-up booked" },
        { k: "Record", v: "Shared with ANC module", tone: "ok" },
      ],
      action: "Replay workflow",
    },
  ],

  pharmacy: [
    {
      label: "e-Rx in",
      screen: "Prescription Queue",
      rows: [
        { k: "From", v: "TamamHealth HMIS · OPD" },
        { k: "Patient", v: "Majok Akol · M · 8y" },
        { k: "Rx", v: "Amoxicillin 250mg susp" },
        { k: "Queue", v: "4 pending" },
      ],
      action: "Check stock",
    },
    {
      label: "Stock",
      screen: "Inventory · FEFO Pick",
      rows: [
        { k: "Suggested batch", v: "B-1183 · exp 11/26", tone: "ok" },
        { k: "FEFO", v: "Earliest expiry first", tone: "ok" },
        { k: "On hand", v: "36 bottles" },
        { k: "Expiry alert", v: "None inside 90 days", tone: "ok" },
      ],
      action: "Dispense",
    },
    {
      label: "Dispense",
      screen: "Dispense · Safety Checks",
      rows: [
        { k: "Dose", v: "Weight-based · 8y · OK", tone: "ok" },
        { k: "Allergies", v: "None on record", tone: "ok" },
        { k: "Interactions", v: "None found", tone: "ok" },
        { k: "Label", v: "Printed · Arabic + English" },
      ],
      action: "Take payment",
    },
    {
      label: "Payment",
      screen: "POS · Checkout",
      rows: [
        { k: "Method", v: "M-Gurush", tone: "ok" },
        { k: "Amount", v: "SSP 950" },
        { k: "Receipt", v: "SMS + printed" },
        { k: "Day total", v: "SSP 41,300 · reconciled", tone: "ok" },
      ],
      action: "Update inventory",
    },
    {
      label: "Inventory",
      screen: "Inventory · After Dispense",
      rows: [
        { k: "Batch B-1183", v: "35 bottles left" },
        { k: "Reorder point", v: "30-day buffer OK", tone: "ok" },
        { k: "Controlled log", v: "n/a for this item" },
        { k: "Donor tag", v: "UNICEF consignment tracked", tone: "ok" },
      ],
      action: "Replay workflow",
    },
  ],

  feedback: [
    {
      label: "Capture",
      screen: "Kiosk · OPD Discharge",
      rows: [
        { k: "Channel", v: "Kiosk (also SMS / WhatsApp)" },
        { k: "Rating", v: "★★ 2 of 5", tone: "warn" },
        { k: "Category", v: "Waiting time" },
        { k: "Comment", v: "“Waited 3 hours”" },
      ],
      action: "Submit feedback",
    },
    {
      label: "Auto-flag",
      screen: "Sentiment · Routing",
      rows: [
        { k: "Detection", v: "Low rating → follow-up", tone: "warn" },
        { k: "Queue", v: "Duty officer" },
        { k: "SLA", v: "4-hour response window" },
        { k: "Anonymous", v: "No — patient opted in" },
      ],
      action: "Open ticket",
    },
    {
      label: "Follow-up",
      screen: "Ticket · FDB-0192",
      rows: [
        { k: "Owner", v: "A. Juma · Front desk lead" },
        { k: "Action", v: "Called patient · apologised" },
        { k: "Root cause", v: "Triage queue backlog" },
        { k: "Status", v: "In progress", tone: "warn" },
      ],
      action: "Resolve ticket",
    },
    {
      label: "Resolve",
      screen: "Ticket · Closed",
      rows: [
        { k: "Resolution", v: "Extra triage staff at peak" },
        { k: "Closed in", v: "3h 12m — inside SLA", tone: "ok" },
        { k: "Patient notified", v: "SMS sent", tone: "ok" },
        { k: "Loop", v: "Closed", tone: "ok" },
      ],
      action: "View trends",
    },
    {
      label: "Trends",
      screen: "Dashboard · This Month",
      rows: [
        { k: "OPD satisfaction", v: "4.1 ★ · up from 3.6", tone: "ok" },
        { k: "NPS", v: "+34" },
        { k: "Top complaint", v: "Waiting time · improving", tone: "ok" },
        { k: "Open tickets", v: "2 · both inside SLA", tone: "ok" },
      ],
      action: "Replay workflow",
    },
  ],
};

export function PlatformWorkflowPlayer({ slug, accent }: { slug: string; accent: string }) {
  const steps = WORKFLOWS[slug];
  const [stepIndex, setStepIndex] = useState(0);
  if (!steps) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const advance = () => setStepIndex(isLast ? 0 : stepIndex + 1);

  return (
    <div className="mk-workflow-player" style={{ "--wf-accent": accent } as React.CSSProperties}>
      <div className="mk-workflow-player-head">
        <p className="mk-workflow-player-hint">Interactive — click through the workflow</p>
        <div className="mk-workflow-stepper" role="tablist" aria-label="Workflow steps">
          {steps.map((s, i) => (
            <button
              key={s.label}
              type="button"
              role="tab"
              aria-selected={i === stepIndex}
              className={`mk-workflow-step${i === stepIndex ? " is-active" : ""}${i < stepIndex ? " is-done" : ""}`}
              onClick={() => setStepIndex(i)}
            >
              <span className="mk-workflow-step-num">{i < stepIndex ? "✓" : i + 1}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mk-workflow-screen" aria-live="polite">
        <div className="mk-workflow-screen-bar">
          <span className="mk-workflow-screen-title">{step.screen}</span>
          <span className="mk-workflow-screen-count">Step {stepIndex + 1} of {steps.length}</span>
        </div>
        <div className="mk-workflow-screen-body">
          {step.rows.map((row) => (
            <div className="mk-workflow-row" key={row.k}>
              <span className="mk-workflow-row-k">{row.k}</span>
              <span className={`mk-workflow-row-v${row.tone ? ` is-${row.tone}` : ""}`}>{row.v}</span>
            </div>
          ))}
        </div>
        <div className="mk-workflow-screen-foot">
          <button type="button" className="mk-workflow-action" onClick={advance}>
            {step.action} {!isLast && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
