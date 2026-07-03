import { PRODUCT_CARDS } from "@/data/products";
import { RelatedLinksGrid, SplitFeatureBlock } from "@/components/marketing/MarketingShared";

export function ProductListing() {
  const [featured, ...rest] = PRODUCT_CARDS;

  return (
    <div id="products-grid">
      <SplitFeatureBlock
        eyebrow={`Tamam Platform — ${featured.acronym}`}
        title={featured.title}
        body={featured.description}
        checks={featured.modules.slice(0, 4)}
        image={featured.image}
        imageAlt={featured.imageAlt}
        tone="navy"
      />

      <RelatedLinksGrid
        heading="The rest of the platform"
        items={rest.map((product) => ({
          label: product.acronym,
          title: product.title,
          body: product.description,
          image: product.image,
        }))}
      />
    </div>
  );
}
