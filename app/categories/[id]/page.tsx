import { notFound } from "next/navigation";

import {
  CategoryEditor,
  type CategoryEditorData,
} from "@/components/categories/category-editor";

const categories: CategoryEditorData[] = [
  { id: "housing", name: "Housing", iconIndex: 0, colorIndex: 0 },
  { id: "dining", name: "Dining", iconIndex: 1, colorIndex: 4 },
  { id: "shopping", name: "Shopping", iconIndex: 2, colorIndex: 3 },
  { id: "transport", name: "Transport", iconIndex: 3, colorIndex: 1 },
  { id: "health", name: "Health", iconIndex: 4, colorIndex: 2 },
  { id: "insurance", name: "Insurance", iconIndex: 4, colorIndex: 5 },
  { id: "gifts", name: "Gifts", iconIndex: 5, colorIndex: 4 },
  { id: "income", name: "Income", iconIndex: 6, colorIndex: 2 },
];

export function generateStaticParams() {
  return categories.map(({ id }) => ({ id }));
}

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = categories.find((item) => item.id === id);

  if (!category) notFound();

  return <CategoryEditor category={category} />;
}
