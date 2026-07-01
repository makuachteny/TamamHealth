import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { ProductListing } from "@/components/marketing/ProductListing";

export const metadata: Metadata = {
  title: "Platform · TamamHealth Digital Health",
  description: "Connected clinical care, facility operations, billing, pharmacy, lab, referrals, and reporting for South Sudan health facilities.",
};

export default function ProductsPage() {
  return (
    <main className="mk-main">
      <MarketingHero
        variant="split"
        eyebrow="OUR PLATFORM"
        title="Connected tools for clinical care and facility operations"
        subtitle="Pick what fits the kind of facility you run; every service shares the same patient record, offline sync, billing traceability, and DHIS2-ready reporting."
        primaryCta={{ label: "Request a demo", href: "/about/contact?intent=demo#contact-form" }}
        secondaryCta={{ label: "Browse services", href: "#products-grid" }}
        stats={[
          { value: "6", label: "services on one record" },
          { value: "Offline", label: "sync by design" },
          { value: "Pilot", label: "facilities welcome" },
        ]}
        className="mk-hero-products"
      />
      <ProductListing />
    </main>
  );
}
