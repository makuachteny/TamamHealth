import { HomeHero } from "@/components/marketing/HomeHero";
import {
  HomeLearnSection,
  HomePlatformSection,
  HomePrinciplesSection,
} from "@/components/marketing/HomeSections";

export default function MarketingHome() {
  return (
    <>
      <HomeHero />
      <HomePrinciplesSection />
      <HomePlatformSection />
      <HomeLearnSection />
    </>
  );
}
