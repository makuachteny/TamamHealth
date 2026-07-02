import Link from "next/link";
import { PRODUCT_CARDS } from "@/data/products";
import { MarketingActionModalButton } from "@/components/marketing/MarketingActionModal";
import { Reveal } from "@/components/marketing/MarketingShared";

export function ProductListing() {
  const [featured, ...rest] = PRODUCT_CARDS;

  return (
    <section id="products-grid" className="mk-section mk-section-after-hero mk-section-white mk-platform-connects">
      <div className="mk-container mk-platform-connects-grid">
        <Reveal>
          <div className="mk-platform-connects-copy">
            <p className="mk-label mk-label-orange">Tamam Platform</p>
            <h2 className="mk-h2">Tamam health infrastructure connects</h2>
            <p className="mk-body">
              Six connected systems, one shared patient record. No switching between tools, no duplicate entry, no data lost between departments. Built for everything from a rural PHCU to a full state referral hospital.
            </p>
            <MarketingActionModalButton
              intent="demo"
              className="mk-btn mk-btn-blue mk-platform-connects-cta"
              source="products-platform-connects"
            >
              Book a Demo
            </MarketingActionModalButton>
          </div>
        </Reveal>

        <Reveal>
          <div className="mk-platform-connects-cards">
            <Link href={`/products/${featured.slug}`} className="mk-platform-card mk-platform-card--featured">
              <span className="mk-platform-card-mark" aria-hidden="true" />
              <h3>{featured.title}</h3>
              <p className="mk-platform-card-desc">{featured.description}</p>
              <p className="mk-platform-card-tagline">{featured.tagline}</p>
              <div className="mk-platform-card-tags">
                {featured.modules.slice(0, 3).map((moduleName) => (
                  <span key={moduleName}>{moduleName}</span>
                ))}
              </div>
            </Link>

            {rest.map((product) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="mk-platform-card">
                <h3>{product.title}</h3>
                <p className="mk-platform-card-desc">{product.description}</p>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
