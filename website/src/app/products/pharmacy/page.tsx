import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductCTA, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Pharmacy Management System (PMS) · TamamHealth",
  description: "Stock-to-dispense for retail pharmacies and hospital pharmacies — batch tracking, expiry management, electronic Rx, POS, and controlled-substance audit trail.",
};

export default function PharmacyManagementPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="PHARMACY MANAGEMENT SYSTEM"
          title="Stock in. Rx out. Counted right."
          subtitle="Tight inventory control with batch + expiry tracking, electronic prescription dispensing, POS for over-the-counter sales, and a clean audit trail for controlled substances."
          accentColor="var(--tb-green-dark)"
          primaryCta={{ label: "Request a demo", href: "/about/contact" }}
          secondaryCta={{ label: "See pricing", href: "/pricing" }}
          illustration={<ProductIllustration accent="var(--tb-green-dark)" variant="pharmacy" />}
        />

        <ProductModuleGrid
          eyebrow="MODULES INCLUDED"
          heading="From supplier to patient"
          modules={[
            { title: "Inventory & Batches", description: "Receive stock with batch number, expiry, supplier, and unit cost. FIFO + FEFO dispense logic enforced automatically." },
            { title: "Expiry Tracking", description: "30/60/90 day expiry alerts. Quarantined-stock list to prevent dispensing of recalled or expired product." },
            { title: "Reorder Alerts", description: "Per-item reorder thresholds and lead time. Auto-generated supplier order draft when stock dips." },
            { title: "Electronic Rx Dispensing", description: "Prescriptions arrive from any clinician on the platform. Pharmacist sees indication, dose, duration, and patient allergies before dispensing." },
            { title: "POS for OTC", description: "Walk-in retail sales with product scan, mobile money, and auto-printed receipt." },
            { title: "Controlled Substances", description: "Schedule II/III audit trail with two-staff witness sign-off. Daily reconciliation forced before close-of-shift." },
            { title: "Drug-interaction Checking", description: "Interaction lookup at the point of dispensing — flagged before the patient leaves the counter." },
            { title: "Reporting", description: "Stock value on hand, dispense volume by therapeutic class, monthly LMIS report ready for upload." },
          ]}
        />

        <ProductBenefits
          eyebrow="WHY PHARMACIES PICK TamamHealth PMS"
          heading="Tight controls, easy day-to-day"
          accentColor="var(--tb-green-dark)"
          benefits={[
            { title: "Stops expired-stock dispensing", description: "FEFO logic + barcode scan at dispense. The expired tin in the corner cabinet can't be sold by accident." },
            { title: "Mobile money at the counter", description: "M-Gurush, MTN MoMo, Airtel Money — patient pays at the till, transaction logged to the receipt automatically." },
            { title: "Works with hospital prescriptions", description: "If your facility runs TamamHealth HMIS, prescriptions arrive electronically. No more squinting at handwriting." },
            { title: "Controlled-substance log audit", description: "Every Schedule II/III movement signed by two staff. Print or export for SSDRA inspections." },
            { title: "Donor-supplied stock support", description: "Tag stock by donor (UNICEF, Global Fund, etc.) and report consumption back to the donor automatically." },
            { title: "Counter-friendly UX", description: "Keyboard-only flow for high-volume counters. A trained dispenser can clear a 10-line prescription in under 90 seconds." },
          ]}
        />

        <ProductCTA
          heading="See PMS at your counter"
          subtitle="We'll set up your formulary, import your current stock list, and show your team the dispense flow in under an hour."
          primaryCta={{ label: "Request a demo", href: "/about/contact" }}
        />
      </main>
      
    </>
  );
}
