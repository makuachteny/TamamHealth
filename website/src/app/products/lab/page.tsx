import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductCTA, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Laboratory Information System (LIS) · TamamHealth",
  description: "Order-to-result workflow for diagnostic centres and hospital labs in South Sudan — instrument integration, TAT tracking, critical-result alerts.",
};

export default function LabManagementPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="LABORATORY INFORMATION SYSTEM"
          title="From order to result — without the paperwork."
          subtitle="Receive orders from any clinician on the platform, run the bench workflow, capture results, and release them back to the requester. With turnaround-time tracking, instrument integration, and critical-value alerts."
          accentColor="var(--tb-gold-dark)"
          primaryCta={{ label: "Request a demo", href: "/about/contact" }}
          secondaryCta={{ label: "See pricing", href: "/pricing" }}
          illustration={<ProductIllustration accent="var(--tb-gold-dark)" variant="lab" />}
        />

        <ProductModuleGrid
          eyebrow="MODULES INCLUDED"
          heading="The full bench workflow"
          modules={[
            { title: "Order Intake", description: "Orders flow in from the OPD, IPD, or external clinics. Specimen requirements, fasting flags, and STAT priority captured." },
            { title: "Specimen Tracking", description: "Print barcoded labels, scan in at receipt, track every tube through accession → centrifuge → bench → released." },
            { title: "Result Capture", description: "Numeric results validated against reference ranges per age and sex. Free-text microscopy + structured chemistry side by side." },
            { title: "Quality Control", description: "Daily QC runs logged with Westgard rules. Out-of-range QC flags the bench before any patient sample releases." },
            { title: "TAT Dashboards", description: "Order-to-result turnaround per test, per shift, per technologist — with SLA breach alerts." },
            { title: "Instrument Integration", description: "LIS-2A and HL7 connectors for hematology analyzers, chemistry analyzers, immunoassay platforms." },
            { title: "Critical Result Alerts", description: "Hb < 5, K+ > 6.5, Plt < 20 — auto-flagged and SMS-notified to the ordering clinician within 60 seconds of release." },
            { title: "Reporting", description: "Test volume, positivity rates by disease, defaulter list for follow-up tests, monthly DHIS2 push." },
          ]}
        />

        <ProductBenefits
          eyebrow="WHY LABS PICK TamamHealth LIS"
          heading="Designed for the bench, not the boardroom"
          accentColor="var(--tb-gold-dark)"
          benefits={[
            { title: "Cuts result-release time in half", description: "Direct instrument integration removes manual transcription. A typical FBC report goes from 25 min to under 10." },
            { title: "Works disconnected", description: "If the network drops, the bench keeps running. Results queue locally and sync when the link is back." },
            { title: "South Sudan reference ranges built in", description: "Hb cutoffs adjusted for high-altitude reference + pediatric weight bands. Tropical disease panels pre-configured." },
            { title: "Audit-ready", description: "Every result has an immutable audit trail — who ran it, on what instrument, when, and against what QC batch." },
            { title: "External order routing", description: "Receive samples from clinics that don't run TamamHealth — they get a lab-result PDF + SMS at no extra cost." },
            { title: "Drug-resistance + outbreak signal", description: "Built-in tracking for malaria RDT, TB, HIV viral load — feeds straight into the surveillance module." },
          ]}
        />

        <ProductCTA
          heading="Bring your bench online"
          subtitle="We'll connect your existing analyzers, configure your test menu, and train your technologists. Most labs are running in under two weeks."
          primaryCta={{ label: "Schedule a site visit", href: "/about/contact" }}
        />
      </main>
      
    </>
  );
}
