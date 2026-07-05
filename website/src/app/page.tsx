import { HomeHero } from "@/components/marketing/HomeHero";
import { HomeProblemSection } from "@/components/marketing/HomeSections";
import { PlatformExplorer } from "@/components/marketing/PlatformExplorer";
import { AboutSection } from "@/components/marketing/AboutSection";
import { DownloadSection } from "@/components/marketing/DownloadSection";
import { ContactSection } from "@/components/marketing/ContactSection";

/* One-page marketing site: every former route now lives here as an anchored
   section (#products, #about, #download, #contact) and the nav scrolls
   instead of navigating. Only /privacy and /terms remain separate pages. */
export default function MarketingHome() {
  return (
    <>
      <HomeHero />
      <HomeProblemSection />
      <div id="products">
        <PlatformExplorer />
      </div>
      <AboutSection />
      <DownloadSection />
      <ContactSection />
    </>
  );
}
