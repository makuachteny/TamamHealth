import type { Metadata } from "next";
import {
  ProductHero, ProductModuleGrid, ProductBenefits, ProductIllustration,
} from "@/components/marketing/ProductPage";

export const metadata: Metadata = {
  title: "Radiology Information System (RIS) · TamamHealth",
  description: "Imaging workflow for radiology centres and hospital imaging departments — modality scheduling, structured reporting, optional PACS integration.",
};

export default function RadiologyManagementPage() {
  return (
    <>
      
      <main className="mk-main">
        <ProductHero
          eyebrow="RADIOLOGY INFORMATION SYSTEM"
          title="Schedule. Acquire. Report. Send."
          subtitle="A modality-first imaging workflow that keeps your radiographers and reporting radiologists in sync — even when the radiologist is reading remotely from Juba."
          accentColor="#1B7FA8"
          primaryCta={{ label: "Request a demo", href: "/about/contact" }}
          illustration={<ProductIllustration accent="#1B7FA8" variant="imaging" />}
        />

        <ProductModuleGrid
          eyebrow="MODULES INCLUDED"
          heading="Imaging from request to report"
          modules={[
            { title: "Modality Scheduling", description: "Slot-based scheduling for X-Ray, Ultrasound, CT, MRI. Automatic prep instructions and contrast warnings." },
            { title: "Accession Numbers", description: "Unique accession per study, printable on the contrast bottle and the patient wristband." },
            { title: "Worklist", description: "Live worklist on the modality console — no more re-typing patient details into the machine." },
            { title: "Structured Reporting", description: "Templated reports per modality and indication. Side-by-side previous study comparison." },
            { title: "PACS Integration", description: "Push DICOM studies to a local Orthanc or to a cloud PACS. Reading workstations get instant access." },
            { title: "DICOM Export", description: "Patient-on-CD or USB export with the report PDF — for second opinions outside the network." },
            { title: "Patient History", description: "Every prior study for the same patient is one click away when reporting a new one." },
            { title: "Reporting", description: "Procedure volumes, modality utilization, repeat-rate, missed-appointment rates." },
          ]}
        />

        <ProductBenefits
          eyebrow="BUILT FOR REMOTE READING"
          heading="Right for radiology in low-bandwidth settings"
          accentColor="#1B7FA8"
          benefits={[
            { title: "Lossless thumbnails first", description: "The radiologist sees a tiny thumbnail in seconds and a full-resolution download is on the way. No more waiting for a 100MB CT to render before knowing if it's the right study." },
            { title: "Reads anywhere with internet", description: "Reporting radiologist in Juba, modality in Bor — the report comes back to the requesting clinician at the source facility." },
            { title: "Pre-loaded report templates", description: "Chest X-ray for TB screening, obstetric ultrasound, FAST scan for trauma — every template in line with WHO guidance." },
            { title: "Repeat-rate tracking", description: "Know which radiographer is repeating and on which modality. Coach. Improve outcomes." },
            { title: "Patient-take-home reports", description: "Auto-generated PDF + SMS link, in English plus the patient's home language." },
            { title: "Optional PACS, no lock-in", description: "Use the open-source Orthanc bundle, your existing PACS, or no PACS at all. Studies still flow." },
          ]}
        />
      </main>
      
    </>
  );
}
