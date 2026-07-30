import { notFound } from "next/navigation";

import {
  AccountEditor,
  type AccountEditorData,
} from "@/components/accounts/account-editor";

const accounts: AccountEditorData[] = [
  {
    id: "primary-account",
    name: "Primary account",
    type: "bank",
    balance: "12600.01",
    includeInTotal: true,
    colorIndex: 0,
    imageIndex: 0,
  },
  {
    id: "esewa",
    name: "eSewa",
    type: "wallet",
    balance: "1900",
    includeInTotal: true,
    colorIndex: 1,
    imageIndex: 1,
  },
  {
    id: "savings",
    name: "Savings",
    type: "savings",
    balance: "5000",
    includeInTotal: false,
    colorIndex: 2,
    imageIndex: 2,
  },
  {
    id: "cash",
    name: "Cash",
    type: "cash",
    balance: "500",
    includeInTotal: true,
    colorIndex: 3,
    imageIndex: 3,
  },
];

export function generateStaticParams() {
  return accounts.map(({ id }) => ({ id }));
}

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = accounts.find((item) => item.id === id);

  if (!account) notFound();

  return <AccountEditor account={account} />;
}
