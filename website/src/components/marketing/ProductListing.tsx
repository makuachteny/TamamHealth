import { PRODUCT_CARDS } from "@/data/products";
import { RelatedLinksGrid } from "@/components/marketing/MarketingShared";

export function ProductListing() {
  return (
    <div id="products-grid">
      <RelatedLinksGrid
        heading="Learn more"
        items={PRODUCT_CARDS.map((product) => ({
          label: product.acronym,
          title: product.title,
          body: product.description,
          image: product.image,
        }))}
      />
    </div>
  );
}
