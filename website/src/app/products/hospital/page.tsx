import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Hospital Management System (HMIS) · TamamHealth",
  description: "Comprehensive hospital ERP for South Sudan — OPD, IPD, wards, lab, imaging, pharmacy, billing, HR, and DHIS2 reporting on one platform.",
};

export default function HospitalManagementPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="HOSPITAL MANAGEMENT SYSTEM"
          title="One platform for the whole hospital."
          subtitle="From the OPD queue at 6am to the night-shift handover, TamamHealth HMIS runs every department on one shared patient record. Built for the realities of intermittent power and bandwidth in South Sudan."
          accentColor="var(--tb-blue-700)"
          primaryCta={{ label: "Request a demo", href: "/about/contact?intent=demo#contact-form" }}
          illustration={<ProductIllustration accent="#2191D0" variant="vitals" />}
        />

        <ProductModuleGrid
          eyebrow="MODULES INCLUDED"
          heading="Everything a Level 3+ hospital needs"
          modules={[
            { title: "Patient Registry", description: "Geocode-anchored patient identifier, household linkage, deduplication across visits and facilities." },
            { title: "Outpatient Care", description: "Triage queue, consultation room workflow, SOAP notes, AI-assisted documentation." },
            { title: "Inpatient Care", description: "Admission orders, daily progress notes, medication administration record (MAR), discharge summaries." },
            { title: "Ward & Bed Management", description: "Live bed map per ward, occupancy %, isolation flags, bed turnover and cleaning workflow." },
            { title: "Nursing Care", description: "Vitals capture, fluid balance, wound assessment, handover sheets between shifts." },
            { title: "Laboratory", description: "Order set up, sample tracking, instrument integration, critical-result alerts back to the requesting clinician." },
            { title: "Imaging", description: "Modality scheduling, radiology worklist, structured reporting, optional PACS integration." },
            { title: "Pharmacy", description: "Inventory with batch + expiry, electronic prescription dispensing, drug-interaction checking." },
            { title: "Billing & Payments", description: "Per-patient ledger, mobile money (M-Gurush, MTN MoMo), insurance claim submission, payment plans." },
            { title: "HR & Payroll", description: "Staff roster, leave management, shift schedule, monthly payroll register." },
            { title: "Asset Management", description: "Equipment registry with service intervals, warranty tracking, maintenance log per asset." },
            { title: "Reporting & BI", description: "DHIS2 export ready, KPI dashboards by department, monthly HMIS report (105) automation." },
          ]}
        />

        <ProductBenefits
          eyebrow="WHY HOSPITALS CHOOSE TamamHealth"
          heading="Built for the hospital you actually run"
          accentColor="var(--tb-blue-700)"
          benefits={[
            { title: "Offline-first by design", description: "Every workstation keeps a local copy. When the link comes back, changes sync. No more lost charts when the satellite drops." },
            { title: "DHIS2 sync out of the box", description: "Monthly HMIS report (105), weekly epidemiological report, and ad-hoc data values push to hmis.southsudan.health automatically." },
            { title: "Mobile money built in", description: "Collect payments via M-Gurush, MTN MoMo, or Airtel Money. Receipts SMS or print at the cashier." },
            { title: "Role-based by South Sudan reality", description: "Boma Health Worker, Payam Supervisor, HRIO, Medical Superintendent — every cadre in the SS health system has its own dashboard." },
            { title: "Multi-language ready", description: "English, Juba Arabic, Dinka, and Nuer locale packs. Switch per user, per facility, or per organization." },
            { title: "Local hosting + cloud option", description: "Run on a $300 mini-PC at the facility, or on cloud. Encryption in transit and at rest, with SS data sovereignty controls." },
          ]}
        />
      </main>
      
    </>
  );
}
