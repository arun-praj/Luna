export type LoanComponent = "disbursement" | "principal" | "interest" | "fee";

export function isLoanTransaction(value: {
  loanId?: string | null;
  loanComponent?: LoanComponent | null;
}) {
  return Boolean(value.loanId && value.loanComponent);
}

export function loanActivityLabel(component: LoanComponent) {
  switch (component) {
    case "disbursement":
      return "Loan started";
    case "principal":
      return "Principal payment";
    case "interest":
      return "Interest payment";
    case "fee":
      return "Loan fee";
  }
}
