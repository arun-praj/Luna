import { CategoryEditor } from "@/components/categories/category-editor";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CategoryEditor categoryId={id} />;
}
