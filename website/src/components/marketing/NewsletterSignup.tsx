"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check } from "@/components/marketing/icons";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("submitting");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Unable to subscribe right now." }));
        throw new Error(body.error || "Unable to subscribe right now.");
      }

      setEmail("");
      setStatus("success");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Unable to subscribe right now.");
    }
  };

  return (
    <form className="mk-newsletter-form" onSubmit={handleSubmit}>
      <label className="mk-newsletter-field">
        <span>Email address</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>
      <button className="mk-btn mk-btn-green mk-newsletter-button" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Subscribing..." : "Subscribe"}
        {status !== "submitting" && <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />}
      </button>
      {status === "success" && (
        <p className="mk-newsletter-status mk-newsletter-status-success" role="status">
          <Check size={16} strokeWidth={1.9} aria-hidden="true" /> You are subscribed.
        </p>
      )}
      {error && <p className="mk-newsletter-status mk-newsletter-status-error" role="alert">{error}</p>}
    </form>
  );
}
