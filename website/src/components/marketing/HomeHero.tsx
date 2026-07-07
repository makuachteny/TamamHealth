"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Calendar, Check } from "@/components/marketing/icons";
import { Reveal } from "./MarketingShared";

const HERO_TITLE_LINES = [
  "Remember",
  "every",
  "patient.",
  "Run the",
  "next visit.",
] as const;

const HERO_RAILS = [
  [
    { src: "/assets/Dashboard.png", alt: "Tamam facility dashboard", label: "Facility dashboard" },
    { src: "/assets/doctor-nurse-consultation.jpg", alt: "Clinical team reviewing patient information", label: "Clinical care" },
    { src: "/assets/doctor-tablet-review.jpg", alt: "Doctor reviewing care data on a tablet", label: "Care review" },
  ],
  [
    { src: "/assets/community-health-worker.jpg", alt: "Community health worker supporting patient care", label: "Patient experience" },
    { src: "/assets/doctor-prescription.jpg", alt: "Doctor preparing a prescription", label: "Pharmacy and orders" },
    { src: "/assets/health-data.jpg", alt: "Health data dashboard and reporting", label: "Reporting" },
  ],
] as const;

type DemoFormData = {
  name: string;
  facility: string;
  email: string;
  phone: string;
  location: string;
};

type DemoSlot = {
  id: string;
  label: string;
  startTime: string;
  schedulingUrl?: string;
  source: "calendly" | "fallback";
};

export function HomeHero() {
  const [step, setStep] = useState<"details" | "schedule" | "done">("details");
  const [demoForm, setDemoForm] = useState<DemoFormData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [slots, setSlots] = useState<DemoSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingUrl, setBookingUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (step !== "schedule") return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadAvailability() {
      setSlotsLoading(true);
      setFormError("");

      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
        const res = await fetch(`/api/calendly/availability?timeZone=${encodeURIComponent(timeZone)}`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({ slots: [] }));

        if (!res.ok) {
          throw new Error(data.error || "Unable to load availability.");
        }

        if (!cancelled) {
          setSlots(Array.isArray(data.slots) ? data.slots : []);
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setFormError("Unable to load live availability. Please choose a fallback time or open the calendar link after submitting.");
          setSlots([]);
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }

    loadAvailability();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [step]);

  const handleDemoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (step === "details") {
      const data = new FormData(event.currentTarget);
      setDemoForm({
        name: String(data.get("name") || ""),
        facility: String(data.get("facility") || ""),
        email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
        location: String(data.get("location") || ""),
      });
      setStep("schedule");
      return;
    }

    if (!demoForm || !selectedSlot) {
      setFormError("Choose an available demo time.");
      return;
    }

    setSubmitting(true);
    const slot = slots.find((item) => item.id === selectedSlot);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: demoForm.name,
          email: demoForm.email,
          facility: demoForm.facility,
          phone: demoForm.phone,
          location: demoForm.location,
          selectedSlot: slot?.label || selectedSlot,
          selectedStartTime: slot?.startTime || selectedSlot,
          calendlySchedulingUrl: slot?.schedulingUrl,
          source: "home-hero-scheduler",
          message: [
            `Requested demo time: ${slot?.label || selectedSlot}`,
            "",
            "Submitted from the home page demo scheduler.",
          ].filter(Boolean).join("\n"),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unable to confirm the demo time." }));
        throw new Error(data.error || "Unable to confirm the demo time.");
      }

      const data = await res.json().catch(() => ({ schedulingUrl: "" }));
      setBookingUrl(data.schedulingUrl || slot?.schedulingUrl || "");
      setStep("done");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to confirm the demo time.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mk-hero mk-home-hero">
      <div className="mk-home-union-field" aria-hidden="true">
        {Array.from({ length: 33 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="mk-container">
        <Reveal>
          <div className="mk-home-hero-grid">
            <div className="mk-home-hero-shell">
              <p className="mk-home-hero-kicker">Offline-ready digital health infrastructure</p>
              <h1 className="mk-h1 mk-home-hero-title">
                <span className="mk-home-title-desktop">
                  {HERO_TITLE_LINES.map((line) => (
                    <span className="mk-home-hero-title-lead" key={`desktop-${line}`}>{line}</span>
                  ))}
                </span>
                <span className="mk-home-title-mobile">
                  {HERO_TITLE_LINES.map((line) => (
                    <span className="mk-home-hero-title-lead" key={`mobile-${line}`}>{line}</span>
                  ))}
                </span>
              </h1>
              <p className="mk-home-hero-subtitle">
                Tamam helps clinics and hospitals move from paper to one offline-ready patient record across registration, clinical notes, lab, pharmacy, billing, and reporting.
              </p>
            </div>

            <div className="mk-home-hero-visual" aria-label="Tamam product and care workflows">
              <div className="mk-home-hero-rails" aria-hidden="true">
                {HERO_RAILS.map((rail, railIndex) => (
                  <div className={`mk-home-hero-rail mk-home-hero-rail-${railIndex + 1}`} key={`rail-${railIndex}`}>
                    <div className="mk-home-hero-rail-track">
                      {[...rail, ...rail].map((tile, index) => (
                        <div className="mk-home-hero-tile" key={`${tile.label}-${index}`}>
                          <Image
                            src={tile.src}
                            alt={tile.alt}
                            fill
                            sizes="(min-width: 1200px) 14vw, (min-width: 760px) 28vw, 86vw"
                            priority={railIndex === 0 && index === 0}
                          />
                          <span>{tile.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <form className="mk-home-hero-panel" onSubmit={handleDemoSubmit} aria-label="Request a Tamam demo">
                {step === "details" && (
                  <>
                    <h2>Request a free demo</h2>
                    <p>
                      Share a few details and we will follow up with a walkthrough shaped around your facility.
                    </p>
                    <div className="mk-home-hero-form-fields">
                      <label className="mk-home-hero-field">
                        <span>Full name <b aria-hidden="true">*</b></span>
                        <input name="name" autoComplete="name" placeholder="Jane Doe" defaultValue={demoForm?.name || ""} required />
                      </label>
                      <label className="mk-home-hero-field">
                        <span>Facility name <b aria-hidden="true">*</b></span>
                        <input name="facility" autoComplete="organization" placeholder="Clinic or hospital" defaultValue={demoForm?.facility || ""} required />
                      </label>
                      <label className="mk-home-hero-field">
                        <span>Email <b aria-hidden="true">*</b></span>
                        <input name="email" type="email" autoComplete="email" placeholder="name@example.com" defaultValue={demoForm?.email || ""} required />
                      </label>
                      <label className="mk-home-hero-field">
                        <span>Phone <b aria-hidden="true">*</b></span>
                        <input name="phone" type="tel" autoComplete="tel" placeholder="+1 973 566 4336" defaultValue={demoForm?.phone || ""} required />
                      </label>
                      <label className="mk-home-hero-field">
                        <span>City or country</span>
                        <input name="location" autoComplete="address-level2" placeholder="City or country" defaultValue={demoForm?.location || ""} />
                      </label>
                    </div>
                    <button type="submit" className="mk-home-hero-panel-button">
                      Next <ArrowRight size={16} strokeWidth={1.8} />
                    </button>
                  </>
                )}

                {step === "schedule" && (
                  <>
                    <div className="mk-home-hero-calendar-icon">
                      <Calendar size={30} strokeWidth={1.8} aria-hidden="true" />
                    </div>
                    <h2>Choose a demo time</h2>
                    <p>
                      Select an available slot and we will send it to support.tamam@gmail.com and your inbox.
                    </p>
                    {slotsLoading && <p className="mk-home-hero-form-error" role="status">Loading availability...</p>}
                    <div className="mk-home-hero-slot-grid" role="group" aria-label="Available demo times">
                      {slots.map((slot) => (
                        <button
                          className={selectedSlot === slot.id ? "mk-home-hero-slot is-selected" : "mk-home-hero-slot"}
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlot(slot.id)}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                    {formError && <p className="mk-home-hero-form-error" role="alert">{formError}</p>}
                    <div className="mk-home-hero-panel-actions">
                      <button type="button" className="mk-home-hero-panel-back" onClick={() => setStep("details")}>
                        Back
                      </button>
                      <button type="submit" className="mk-home-hero-panel-button" disabled={submitting || !selectedSlot}>
                        {submitting ? "Sending..." : "Send request"} <ArrowRight size={16} strokeWidth={1.8} />
                      </button>
                    </div>
                  </>
                )}

                {step === "done" && (
                  <div className="mk-home-hero-done">
                    <div className="mk-home-hero-calendar-icon">
                      <Check size={30} strokeWidth={1.8} aria-hidden="true" />
                    </div>
                    <h2>Demo time requested</h2>
                    <p>
                      We received your request. Support has been notified and we sent the confirmation to {demoForm?.email}.
                    </p>
                    {bookingUrl && (
                      <a className="mk-home-hero-calendar-link" href={bookingUrl} target="_blank" rel="noreferrer">
                        Finish booking in Calendly
                      </a>
                    )}
                  </div>
                )}
              </form>
            </div>

          </div>
        </Reveal>
      </div>
    </section>
  );
}
