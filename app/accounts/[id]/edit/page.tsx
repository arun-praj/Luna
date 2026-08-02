import { AccountEditor } from "@/components/accounts/account-editor";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AccountEditor accountId={id} />;
}
