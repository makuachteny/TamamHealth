import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Clinic Management System (CMS) · TamamHealth",
  description: "Lean digital health platform for PHCUs, private practices, and faith-based clinics in South Sudan.",
};

export default function ClinicManagementPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="CLINIC MANAGEMENT SYSTEM"
          title="Everything a clinic needs. Nothing it doesn't."
          subtitle="Run your full patient day on one screen — registration, consultation, prescription, dispensing, billing — without paying for inpatient features your facility doesn't have."
          accentColor="var(--tb-green-dark)"
          primaryCta={{ label: "Request a demo", href: "/about/contact" }}
          illustration={<ProductIllustration accent="var(--tb-green-dark)" variant="clinic" />}
        />

        <ProductModuleGrid
          eyebrow="MODULES INCLUDED"
          heading="Everything a single-site clinic needs"
          modules={[
            { title: "Patient Registration", description: "Quick walk-in registration with photo, geocode, and phone — under 90 seconds per patient." },
            { title: "Consultation", description: "Chief complaint → exam → assessment → plan, with offline SOAP templates per common condition." },
            { title: "Prescription", description: "Drug picker tied to your formulary, dose calculator, and pediatric weight-based dosing." },
            { title: "Lab Orders", description: "Order rapid diagnostics (Malaria RDT, HIV, glucose) with results captured at the bench." },
            { title: "Pharmacy Dispensing", description: "Pull from local stock, count down inventory, print or SMS dispense slip." },
            { title: "Billing & Payments", description: "Per-visit charges, mobile money collection, daily reconciliation, end-of-day cash register." },
            { title: "Appointments", description: "Book follow-ups, send SMS reminders, track no-shows automatically." },
            { title: "Reports", description: "Daily census, monthly HMIS, common-conditions trend — auto-generated, ready to print." },
          ]}
        />

        <ProductBenefits
          eyebrow="WHY CLINICS LOVE TamamHealth"
          heading="Lean enough for a single-room clinic"
          accentColor="var(--tb-green-dark)"
          benefits={[
            { title: "Up and running in a day", description: "Browser-based, no server install. Hand the URL to your front desk and you're seeing patients by lunch." },
            { title: "Works on any device", description: "Tablet at the front desk, mid-range Android phone in the consultation room, $200 laptop in the back office. Same experience." },
            { title: "Offline-first", description: "Town power went out? Patient still gets registered, consulted, dispensed. Sync resumes when the link returns." },
            { title: "Pay only for what you use", description: "Tier pricing by patient volume — small Payam clinics pay nothing for inpatient features they'll never touch." },
            { title: "DHIS2 reports auto-built", description: "Your monthly HMIS 105 is generated from the visits you've already entered — no double data entry." },
            { title: "Local language", description: "Switch the UI to Juba Arabic, Dinka, or Nuer for staff who're more comfortable in their working language." },
          ]}
        />
      </main>
      
    </>
  );
}
