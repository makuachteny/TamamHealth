import { HomeHero } from "@/components/marketing/HomeHero";
import {
  HomeAudienceSection,
  HomeFinalCta,
  HomeLearnSection,
  HomeMissionBand,
  HomePlatformSection,
  HomeProblemSection,
} from "@/components/marketing/HomeSections";

export default function MarketingHome() {
  return (
    <>
      <HomeHero />
      <HomeProblemSection />
      <HomePlatformSection />
      <HomeMissionBand />
      <HomeAudienceSection />
      <HomeLearnSection />
      <HomeFinalCta />
    </>
  );
}
