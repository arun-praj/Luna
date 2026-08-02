import { HomeContent } from "@/components/home/home-content";
import { OnboardingGate } from "@/components/auth/onboarding-gate";

export default function Home() {
  return (
    <OnboardingGate>
      <HomeContent />
    </OnboardingGate>
  );
}
