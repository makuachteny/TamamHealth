import { HomeHero } from "@/components/marketing/HomeHero";
import {
  HomeContactSection,
  HomeGoalSection,
  HomePlatformSection,
  HomePrinciplesSection,
  HomeProblemSection,
  HomeTeamSection,
} from "@/components/marketing/HomeSections";

export default function MarketingHome() {
  return (
    <>
      <HomeHero />
      <HomeProblemSection />
      <HomePrinciplesSection />
      <HomePlatformSection />
      <HomeGoalSection />
      <HomeTeamSection />
      <HomeContactSection />
    </>
  );
}
