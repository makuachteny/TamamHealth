"use client";

import { MarketingHero } from "@/components/marketing/MarketingHero";

/* Home hero — full-bleed background photo (midwives outside a tent clinic
   in South Sudan) behind centered copy + CTAs, carrying the homepage
   message. */
export function HomeHero() {
  return (
    <MarketingHero
      variant="photo"
      image="/assets/landing-img.jpg"
      imageAlt="Midwives standing outside a tent clinic in South Sudan"
      imagePriority
      title={<>Many communities.<br />One system of care.</>}
      subtitle="Tamam brings patients, wards, pharmacy, lab, blood bank, maternal & child health, and registration into a single platform for the whole facility — built to work in every corner of South Sudan, online or off, and to scale from one hospital to every community it serves."
      primaryCta={{ label: "Book a demo", href: "/?intent=demo#contact-form" }}
      secondaryCta={{ label: "Explore the platform", href: "/#products" }}
      className="mk-hero-download"
    />
  );
}
