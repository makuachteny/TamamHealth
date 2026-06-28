"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "@/components/marketing/icons";
import { MarketingActionModalButton, getMarketingIntentFromCta } from "./MarketingActionModal";
import { Reveal } from "./MarketingShared";

type HeroCta = {
  label: string;
  href: string;
};

type HeroStat = {
  value: string;
  label: string;
};

export type MarketingHeroVariant =
  | "split"
  | "photo"
  | "product"
  | "console"
  | "portal"
  | "showcase"
  | "mosaic"
  | "impact"
  | "data"
  | "legal"
  | "center";

export function MarketingHero({
  variant = "split",
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  stats,
  media,
  image,
  imageAlt = "",
  imagePriority = false,
  children,
  className = "",
}: {
  variant?: MarketingHeroVariant;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  stats?: HeroStat[];
  media?: ReactNode;
  image?: string;
  imageAlt?: string;
  imagePriority?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const style = image ? ({ "--hero-image": `url("${image}")` } as CSSProperties) : undefined;
  const hasVisual = media || (image && variant !== "photo");
  const imageOnlyVisual = image && !media && variant !== "photo";

  return (
    <section className={`mk-mod-hero mk-mod-hero--${variant} ${className}`} style={style}>
      {variant === "photo" && image && (
        <Image
          src={image}
          alt={imageAlt}
          fill
          className="mk-mod-hero-bg-img"
          priority={imagePriority}
        />
      )}
      <div className="mk-container">
        <div className="mk-mod-hero-inner">
          <Reveal>
            <div className="mk-mod-hero-copy">
              {eyebrow && <p className="mk-label mk-mod-hero-eyebrow">{eyebrow}</p>}
              <h1 className="mk-h1 mk-mod-hero-title">{title}</h1>
              {subtitle && <p className="mk-mod-hero-subtitle">{subtitle}</p>}

              {(primaryCta || secondaryCta) && (
                <div className="mk-mod-hero-actions">
                  {primaryCta && (
                    <HeroCtaLink cta={primaryCta} className="mk-btn mk-btn-green mk-mod-hero-primary">
                      {primaryCta.label}
                    </HeroCtaLink>
                  )}
                  {secondaryCta && (
                    <HeroCtaLink cta={secondaryCta} className="mk-btn mk-btn-outline mk-mod-hero-secondary">
                      {secondaryCta.label}
                      <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                    </HeroCtaLink>
                  )}
                </div>
              )}

              {stats && stats.length > 0 && (
                <div className="mk-mod-hero-stats">
                  {stats.map((stat) => (
                    <div key={`${stat.value}-${stat.label}`}>
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {children}
            </div>
          </Reveal>

          {hasVisual && (
            <Reveal delay={0.1}>
              <div className="mk-mod-hero-visual">
                {media || (
                  <Image
                    src={image as string}
                    alt={imageAlt}
                    width={680}
                    height={520}
                    priority={imagePriority}
                    className={imageOnlyVisual ? "mk-mod-hero-visual-img" : undefined}
                  />
                )}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

function HeroCtaLink({
  cta,
  className,
  children,
}: {
  cta: HeroCta;
  className: string;
  children: ReactNode;
}) {
  const modalIntent = getMarketingIntentFromCta(cta.label, cta.href);
  if (modalIntent) {
    return (
      <MarketingActionModalButton
        intent={modalIntent}
        className={className}
        source={`hero-${modalIntent}-${cta.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      >
        {children}
      </MarketingActionModalButton>
    );
  }

  const isExternal = /^(https?:|mailto:|tel:)/.test(cta.href);

  if (isExternal) {
    return (
      <a
        href={cta.href}
        className={className}
        target={cta.href.startsWith("http") ? "_blank" : undefined}
        rel={cta.href.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={cta.href} className={className}>
      {children}
    </Link>
  );
}
