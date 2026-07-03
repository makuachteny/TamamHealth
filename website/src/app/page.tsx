import { HomeHero } from "@/components/marketing/HomeHero";
import {
  HomeAudienceSection,
  HomePlatformSection,
  HomeProblemSection,
} from "@/components/marketing/HomeSections";

export default function MarketingHome() {
  return (
    <>
      <HomeHero />
      <HomeProblemSection />
      <HomePlatformSection />
      <HomeAudienceSection />
    </>
  );
}
