import { HomeHero } from "@/components/marketing/HomeHero";
import {
  HomeLearnSection,
  HomePlatformSection,
  HomePrinciplesSection,
  HomeStatementSection,
} from "@/components/marketing/HomeSections";

export default function MarketingHome() {
  return (
    <>
      <HomeHero />
      <HomeStatementSection />
      <HomePrinciplesSection />
      <HomePlatformSection />
      <HomeLearnSection />
    </>
  );
}
