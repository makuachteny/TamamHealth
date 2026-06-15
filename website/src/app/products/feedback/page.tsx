import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Patient Feedback Survey · TamamHealth",
  description: "Closed-loop patient experience capture for South Sudan health facilities — kiosk, SMS, WhatsApp, and bedside.",
};

export default function PatientFeedbackPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="PATIENT FEEDBACK SURVEY"
          title="Hear every patient. Close every loop."
          subtitle="Capture satisfaction ratings and open-ended comments from patients in person, by SMS, by WhatsApp, or at a kiosk. Negative feedback auto-flags for follow-up so nothing falls through the cracks."
          accentColor="var(--tb-gold-dark)"
          primaryCta={{ label: "Request a demo", href: "/about/contact" }}
          secondaryCta={{ label: "See the dashboard", href: "/about/contact" }}
          illustration={<ProductIllustration accent="var(--tb-gold-dark)" variant="feedback" />}
        />

        <ProductModuleGrid
          eyebrow="HOW IT WORKS"
          heading="Capture experience, then act on it"
          modules={[
            { title: "Multi-channel Capture", description: "Bedside on a tablet, kiosk in the waiting area, SMS link after discharge, or WhatsApp short code. Patient picks the channel they prefer." },
            { title: "5-star + NPS Scoring", description: "One overall 1-5 star rating, plus an optional 0-10 NPS 'would you recommend' question, plus a free-text comment." },
            { title: "Auto Sentiment Detection", description: "Ratings of 1-2 stars are auto-classified as 'negative' and routed straight to the follow-up queue." },
            { title: "Follow-up Workflow", description: "Each negative response opens a ticket. Assign to a staff member, log the outcome (resolved / won't fix), and close the loop." },
            { title: "Department Trends", description: "Trend by department (OPD, Maternity, Pharmacy, Lab) and by category (wait time, courtesy, cost, cleanliness)." },
            { title: "Anonymous Mode", description: "Patients can submit without identification — useful in cultures where direct criticism is uncomfortable." },
          ]}
        />

        <ProductBenefits
          eyebrow="WHY IT MATTERS"
          heading="The fastest signal you'll get on quality"
          accentColor="var(--tb-gold-dark)"
          benefits={[
            { title: "Catch problems before they escalate", description: "A negative kiosk rating today is a complaint letter you don't get next week." },
            { title: "Built for low-literacy + multilingual", description: "Star icons + emoji faces work without reading. Survey questions translate to Juba Arabic, Dinka, Nuer, English." },
            { title: "Closed-loop accountability", description: "Every negative response gets owned by a named staff member. Outcomes audit-trailed." },
            { title: "Donor reporting friendly", description: "Most international donors require patient-experience metrics. Auto-export the slice they need." },
            { title: "Free with HMIS / CMS", description: "Bundled at no extra cost when you run any other TamamHealth product. Standalone for facilities not yet on the platform." },
            { title: "Anonymous responses count", description: "Don't lose insight from patients who won't speak up by name." },
          ]}
        />
      </main>
      
    </>
  );
}
