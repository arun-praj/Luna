import { FeatureGuide } from "@/components/guides/feature-guide";
import { featureGuides } from "@/components/guides/feature-guide-config";

export default async function SavingsGuidePage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const value = (await searchParams).returnTo;
  return <FeatureGuide config={featureGuides.savings} returnTo={Array.isArray(value) ? value[0] : value} />;
}
