import { ReportViewer } from "@/components/reports/report-viewer";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { returnTo: requestedReturnTo } = await searchParams;
  const returnTo = Array.isArray(requestedReturnTo) ? requestedReturnTo[0] : requestedReturnTo;
  return <ReportViewer returnTo={returnTo} />;
}
