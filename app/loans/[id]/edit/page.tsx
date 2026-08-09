import { LoanEditor } from "@/components/loans/loan-editor";
export default async function EditLoanPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <LoanEditor loanId={id} />; }
