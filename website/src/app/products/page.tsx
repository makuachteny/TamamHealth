import type { Metadata } from "next";
import { ProductsHero } from "@/components/marketing/ProductsHero";
import { ProductListing } from "@/components/marketing/ProductListing";
import { PlatformExplorer } from "@/components/marketing/PlatformExplorer";

export const metadata: Metadata = {
  title: "Platform · TamamHealth Digital Health",
  description: "Connected clinical care, facility operations, billing, pharmacy, lab, referrals, and reporting for South Sudan health facilities.",
};

export default function ProductsPage() {
  return (
    <main className="mk-main">
      <ProductsHero />
      <ProductListing />
      <PlatformExplorer />
    </main>
  );
}
