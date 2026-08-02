import { SavingsInstrumentEditor } from "@/components/savings/savings-instrument-editor";

export default async function EditSavingsInstrumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SavingsInstrumentEditor instrumentId={id} />;
}
