import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Pharmacy Management System (PMS) · Tamam",
  description: "Stock, prescriptions, dispensing, and payment tracking for clinic and hospital pharmacies.",
};

export default function PharmacyManagementPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="PHARMACY MANAGEMENT SYSTEM"
          title="Stock in. Rx out. Counted right."
          subtitle="Track medicines from inventory to dispensing, keep prescriptions tied to the visit, and give facility teams a clearer view of stock and payments."
          accentColor="var(--tb-green-dark)"
          primaryCta={{ label: "Request a demo", href: "/about/contact?intent=demo#contact-form" }}
          illustration={<ProductIllustration accent="#2191D0" variant="pharmacy" />}
        />

        <ProductModuleGrid
          eyebrow="MODULES INCLUDED"
          heading="From supplier to patient"
          modules={[
            { title: "Inventory", description: "Track medicine stock, batches, expiry dates, and on-hand quantities." },
            { title: "Prescriptions", description: "Receive prescriptions from the clinical visit and prepare dispensing." },
            { title: "Dispensing", description: "Record what was dispensed and keep it tied to the patient record." },
            { title: "Payments", description: "Connect pharmacy charges and receipts to the facility ledger." },
            { title: "Reporting", description: "See stock movement and dispensing activity without manual tallies." },
          ]}
        />

        <ProductBenefits
          eyebrow="WHY IT MATTERS"
          heading="Know what is on the shelf"
          accentColor="var(--tb-green-dark)"
          benefits={[
            { title: "Clear stock movement", description: "Inventory changes as medicines are received and dispensed." },
            { title: "Connected prescriptions", description: "Pharmacy work stays connected to the clinical visit." },
            { title: "Fewer side spreadsheets", description: "Stock, dispensing, and payment activity can be reviewed from the same system." },
          ]}
        />
      </main>
      
    </>
  );
}
