import { FeatureGuide } from "@/components/guides/feature-guide";
import { featureGuides } from "@/components/guides/feature-guide-config";

export default async function LoansGuidePage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const value = (await searchParams).returnTo;
  return <FeatureGuide config={featureGuides.loans} returnTo={Array.isArray(value) ? value[0] : value} />;
}
