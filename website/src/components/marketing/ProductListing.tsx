import Link from "next/link";
import { PRODUCT_CARDS } from "@/data/products";
import { ArrowRight } from "@/components/marketing/icons";
import { Reveal } from "@/components/marketing/MarketingShared";

export function ProductListing() {
  return (
    <section id="products-grid" className="mk-section mk-section-after-hero mk-section-white">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-heading">
            <h2 className="mk-h2">Start with the workflow you need</h2>
          </div>
        </Reveal>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: 20,
          }}
        >
          {PRODUCT_CARDS.map((product, index) => (
            <Reveal key={product.slug} delay={index * 0.04}>
              <ProductListingCard product={product} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductListingCard({ product }: { product: (typeof PRODUCT_CARDS)[number] }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      style={{ textDecoration: "none", display: "block", height: "100%" }}
    >
      <div
        style={{
          background: "var(--tb-cream-50)",
          border: "1px solid var(--tb-cream-300)",
          borderRadius: 8,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
        }}
        className="mk-product-list-card"
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 3",
            background: product.bg,
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image}
            alt={product.imageAlt}
            loading="lazy"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 25%",
            }}
          />
        </div>

        <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: "var(--tb-text-pri)" }}>{product.title}</h3>
          <p style={{ fontSize: 14, color: product.accent, fontWeight: 700, margin: "0 0 10px" }}>{product.tagline}</p>
          <p style={{ fontSize: 14.5, color: "var(--tb-text-sec)", lineHeight: 1.5, marginBottom: 14, flex: 1 }}>
            {product.description}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {product.modules.slice(0, 4).map((moduleName) => (
              <span
                key={moduleName}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--tb-text-sec)",
                  background: "var(--tb-cream-100)",
                  border: "1px solid var(--tb-cream-300)",
                  padding: "3px 8px",
                  borderRadius: 999,
                }}
              >
                {moduleName}
              </span>
            ))}
            {product.modules.length > 4 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: product.accent,
                  padding: "3px 8px",
                }}
              >
                +{product.modules.length - 4} more
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: product.accent,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: "auto",
            }}
          >
            Learn more
            <ArrowRight size={14} strokeWidth={1.8} />
          </span>
        </div>
      </div>
    </Link>
  );
}
