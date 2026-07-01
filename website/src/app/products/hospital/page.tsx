import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Hospital Management System (HMIS) · Tamam",
  description: "Offline-ready hospital workflows for registration, clinical notes, lab, pharmacy, billing, and reporting on one patient record.",
};

export default function HospitalManagementPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="HOSPITAL MANAGEMENT SYSTEM"
          title="One patient record for busy hospitals."
          subtitle="Tamam connects the core hospital day: registration, triage, consultation, lab, pharmacy, billing, and reporting. It is built for teams that need records to keep working through poor connectivity."
          accentColor="var(--tb-blue-700)"
          primaryCta={{ label: "Request a demo", href: "/about/contact?intent=demo#contact-form" }}
          illustration={<ProductIllustration accent="#2191D0" variant="vitals" />}
        />

        <ProductModuleGrid
          eyebrow="MODULES INCLUDED"
          heading="The core workflows"
          modules={[
            { title: "Patient registry", description: "Create a patient record once and keep visits, orders, medicines, and payments connected." },
            { title: "Triage and consultation", description: "Move patients through the queue and document the clinical visit in one place." },
            { title: "Lab and pharmacy", description: "Send orders, capture results, and dispense medicines from the same encounter." },
            { title: "Billing", description: "Track charges, balances, receipts, and payment status at the patient level." },
            { title: "Reporting", description: "Use the data already captured during care to prepare cleaner facility reports." },
          ]}
        />

        <ProductBenefits
          eyebrow="WHY IT MATTERS"
          heading="Less paper chasing during the patient day"
          accentColor="var(--tb-blue-700)"
          benefits={[
            { title: "Offline-ready", description: "Care teams can continue documenting during connectivity gaps and sync when the link returns." },
            { title: "Shared record", description: "The front desk, clinician, lab, pharmacy, and cashier work from the same patient story." },
            { title: "Phased rollout", description: "Start with registration and clinical care, then add pharmacy, lab, billing, and reporting as the team is ready." },
          ]}
        />
      </main>
      
    </>
  );
}
