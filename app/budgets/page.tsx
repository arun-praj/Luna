import { Suspense } from "react";

import { BudgetManager } from "@/components/budgets/budget-manager";
import { PageDataSkeleton } from "@/components/ui/data-skeleton";

export default function BudgetsPage() {
  return <Suspense fallback={<main className="min-h-dvh bg-background"><div className="mx-auto max-w-[720px] px-4 pt-24"><PageDataSkeleton /></div></main>}><BudgetManager /></Suspense>;
}
