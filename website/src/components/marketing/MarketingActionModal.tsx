"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, X } from "@/components/marketing/icons";

type MarketingIntent = "demo" | "pricing" | "contact";

type ModalConfig = {
  eyebrow: string;
  title: string;
  description: string;
  subject: string;
  submitLabel: string;
  successTitle: string;
  successBody: string;
  fullPageHref: string;
  fullPageLabel: string;
};

const MODAL_CONFIG: Record<MarketingIntent, ModalConfig> = {
  demo: {
    eyebrow: "Book a demo",
    title: "See TamamHealth around your facility workflow",
    description: "Share a few details and the team will follow up with a walkthrough shaped around your clinic, hospital, or program.",
    subject: "Demo request",
    submitLabel: "Request demo",
    successTitle: "Demo request received",
    successBody: "We received your request and will follow up with the right next step.",
    fullPageHref: "/#get-involved",
    fullPageLabel: "Open the contact section",
  },
  pricing: {
    eyebrow: "Get pricing",
    title: "Request pricing for your facility",
    description: "Tell us the facility type, location, and modules you care about so the pricing conversation starts with the right context.",
    subject: "Pricing request",
    submitLabel: "Request pricing",
    successTitle: "Pricing request received",
    successBody: "We will review your facility details and follow up with a practical pricing path.",
    fullPageHref: "/#get-involved",
    fullPageLabel: "Open the contact section",
  },
  contact: {
    eyebrow: "Contact TamamHealth",
    title: "Send the team a message",
    description: "Use this for partnerships, pilots, support questions, press, or product feedback.",
    subject: "Website contact request",
    submitLabel: "Send message",
    successTitle: "Message received",
    successBody: "We received your message and will route it to the right person.",
    fullPageHref: "/#get-involved",
    fullPageLabel: "Open the contact section",
  },
};

type ActionModalButtonProps = {
  intent: MarketingIntent;
  className?: string;
  children: ReactNode;
  source?: string;
  onOpen?: () => void;
};

export function MarketingActionModalButton({
  intent,
  className,
  children,
  source = "marketing-site",
  onOpen,
}: ActionModalButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const titleId = useId();
  const config = MODAL_CONFIG[intent];

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleOpen = () => {
    onOpen?.();
    setError("");
    setSubmitted(false);
    setSchedulingUrl("");
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const facility = String(data.get("facility") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const location = String(data.get("location") || "").trim();
    const message = String(data.get("message") || "").trim();

    try {
      const response = await fetch(intent === "demo" ? "/api/appointments" : "/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          facility,
          phone,
          location,
          intent,
          role: config.eyebrow,
          source,
          subject: `${config.subject}${facility ? ` - ${facility}` : ""}`,
          message: message || config.description,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Request failed. Please try again." }));
        throw new Error(body.error || "Request failed. Please try again.");
      }

      const body = await response.json().catch(() => ({ schedulingUrl: "" }));
      setSchedulingUrl(body.schedulingUrl || "");
      setSubmitted(true);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={handleOpen}>
        {children}
      </button>

      {open && (
        <div className="mk-action-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <div
            className="mk-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="mk-action-modal-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>

            {submitted ? (
              <div className="mk-action-modal-success">
                <span aria-hidden="true">
                  <Check size={30} strokeWidth={1.9} />
                </span>
                <p className="mk-action-modal-eyebrow">{config.eyebrow}</p>
                <h2 id={titleId}>{config.successTitle}</h2>
                <p>{config.successBody}</p>
                <div className="mk-action-modal-actions">
                  <button type="button" className="mk-btn mk-btn-green" onClick={() => setOpen(false)}>
                    Done
                  </button>
                  {schedulingUrl && (
                    <a href={schedulingUrl} className="mk-btn mk-btn-blue" target="_blank" rel="noreferrer">
                      Finish in Calendly
                    </a>
                  )}
                  <Link href={config.fullPageHref} className="mk-btn mk-btn-outline-green" onClick={() => setOpen(false)}>
                    {config.fullPageLabel}
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <p className="mk-action-modal-eyebrow">{config.eyebrow}</p>
                <h2 id={titleId}>{config.title}</h2>
                <p className="mk-action-modal-copy">{config.description}</p>

                <form className="mk-action-modal-form" onSubmit={handleSubmit}>
                  <div className="mk-action-modal-grid">
                    <label className="mk-action-modal-field">
                      <span>Full name <b aria-hidden="true">*</b></span>
                      <input name="name" autoComplete="name" placeholder="Jane Doe" required />
                    </label>
                    <label className="mk-action-modal-field">
                      <span>Email <b aria-hidden="true">*</b></span>
                      <input name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
                    </label>
                    <label className="mk-action-modal-field">
                      <span>Facility</span>
                      <input name="facility" autoComplete="organization" placeholder="Clinic or hospital" />
                    </label>
                    <label className="mk-action-modal-field">
                      <span>Phone</span>
                      <input name="phone" type="tel" autoComplete="tel" placeholder="+1 973 566 4336" />
                    </label>
                    <label className="mk-action-modal-field mk-action-modal-field-wide">
                      <span>City or country</span>
                      <input name="location" autoComplete="address-level2" placeholder="Juba, South Sudan" />
                    </label>
                    <label className="mk-action-modal-field mk-action-modal-field-wide">
                      <span>What should we know?</span>
                      <textarea
                        name="message"
                        rows={4}
                        placeholder="Facility size, workflow needs, timeline, or the best way to help."
                      />
                    </label>
                  </div>

                  {error && <p className="mk-action-modal-status" role="alert">{error}</p>}

                  <div className="mk-action-modal-actions">
                    <button type="submit" className="mk-btn mk-btn-green" disabled={submitting}>
                      {submitting ? "Sending..." : config.submitLabel}
                      {!submitting && <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />}
                    </button>
                    <Link href={config.fullPageHref} className="mk-action-modal-text-link" onClick={() => setOpen(false)}>
                      {config.fullPageLabel}
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function getMarketingIntentFromCta(label: string, href: string): MarketingIntent | null {
  const text = `${label} ${href}`.toLowerCase();

  if (text.includes("pricing") || text.includes("quote")) {
    return "pricing";
  }

  if (href === "/#get-involved") {
    if (text.includes("demo") || text.includes("walkthrough")) {
      return "demo";
    }

    return "contact";
  }

  return null;
}
