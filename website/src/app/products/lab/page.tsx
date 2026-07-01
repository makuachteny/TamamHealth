import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Laboratory Information System (LIS) · Tamam",
  description: "Order-to-result workflow for clinic and hospital labs, tied back to the patient visit.",
};

export default function LabManagementPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="LABORATORY INFORMATION SYSTEM"
          title="From order to result — without the paperwork."
          subtitle="Receive orders from the clinical visit, capture results, flag critical findings, and release them back to the requester without paper slips."
          accentColor="var(--tb-gold-dark)"
          primaryCta={{ label: "Request a demo", href: "/about/contact?intent=demo#contact-form" }}
          illustration={<ProductIllustration accent="#2191D0" variant="lab" />}
        />

        <ProductModuleGrid
          eyebrow="MODULES INCLUDED"
          heading="The core lab flow"
          modules={[
            { title: "Order intake", description: "Receive lab requests from the patient encounter." },
            { title: "Result capture", description: "Enter numeric and text results in a structured record." },
            { title: "Critical flags", description: "Highlight values that need fast clinical attention." },
            { title: "Reporting", description: "Track lab activity without rebuilding logs from paper." },
          ]}
        />

        <ProductBenefits
          eyebrow="WHY IT MATTERS"
          heading="Results stay connected to care"
          accentColor="var(--tb-gold-dark)"
          benefits={[
            { title: "Less transcription", description: "Orders and results live in the same patient record, reducing duplicate entry." },
            { title: "Offline-ready", description: "The lab can continue capturing work during network gaps." },
            { title: "Visible status", description: "Clinicians can see pending and released results without chasing paper." },
          ]}
        />
      </main>
      
    </>
  );
}
