import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Clinic Management System (CMS) · Tamam",
  description: "Lean offline-ready records for clinics that need registration, consultation, pharmacy, billing, and follow-up.",
};

export default function ClinicManagementPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="CLINIC MANAGEMENT SYSTEM"
          title="A cleaner patient day for clinics."
          subtitle="Run registration, consultation, prescriptions, dispensing, billing, and follow-up without carrying a hospital-sized system."
          accentColor="var(--tb-green-dark)"
          primaryCta={{ label: "Request a demo", href: "/about/contact?intent=demo#contact-form" }}
          illustration={<ProductIllustration accent="#2191D0" variant="clinic" />}
        />

        <ProductModuleGrid
          eyebrow="MODULES INCLUDED"
          heading="Simple clinic workflows"
          modules={[
            { title: "Registration", description: "Create or find the patient record quickly at the front desk." },
            { title: "Consultation", description: "Capture complaint, assessment, plan, prescriptions, and follow-up notes." },
            { title: "Pharmacy", description: "Dispense from local stock and keep medicine activity tied to the visit." },
            { title: "Billing", description: "Record charges and payments without a separate spreadsheet." },
            { title: "Reports", description: "See daily activity and prepare basic facility reports from captured visits." },
          ]}
        />

        <ProductBenefits
          eyebrow="WHY IT MATTERS"
          heading="Small enough to adopt"
          accentColor="var(--tb-green-dark)"
          benefits={[
            { title: "Focused scope", description: "The clinic page stays centered on the visit instead of showing every hospital department." },
            { title: "Offline-ready", description: "Staff can keep working during network gaps and sync once connectivity returns." },
            { title: "Easy to explain", description: "Registration, consultation, pharmacy, billing, and follow-up are visible from the start." },
          ]}
        />
      </main>
      
    </>
  );
}
