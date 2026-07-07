import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { ProductListing } from "@/components/marketing/ProductListing";

export const metadata: Metadata = {
  title: "Platform · Tamam Digital Health",
  description: "Offline-ready health record workflows for clinics and hospitals moving beyond paper.",
};

export default function ProductsPage() {
  return (
    <main className="mk-main">
      <MarketingHero
        variant="split"
        eyebrow="PRODUCTS"
        title="Software for the patient day"
        subtitle="Start with one workflow or run the full facility record. Tamam keeps registration, clinical notes, lab, pharmacy, billing, and reporting connected."
        primaryCta={{ label: "Request a demo", href: "/about/contact?intent=demo#contact-form" }}
        secondaryCta={{ label: "View products", href: "#products-grid" }}
        stats={[
          { value: "4", label: "core workflows" },
          { value: "Offline", label: "ready records" },
          { value: "Demo", label: "available now" },
        ]}
        className="mk-hero-products"
      />
      <ProductListing />
    </main>
  );
}
