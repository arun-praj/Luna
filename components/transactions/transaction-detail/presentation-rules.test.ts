import assert from "node:assert/strict";
import test from "node:test";

import { isLoanTransaction, loanActivityLabel } from "./presentation-rules.ts";

test("loan-linked principal movements present as loan transactions", () => {
  assert.equal(isLoanTransaction({ loanId: "loan-1", loanComponent: "principal" }), true);
  assert.equal(isLoanTransaction({ loanId: "loan-1", loanComponent: "disbursement" }), true);
});

test("ordinary transfers are not presented as loan transactions", () => {
  assert.equal(isLoanTransaction({ loanId: null, loanComponent: null }), false);
  assert.equal(isLoanTransaction({ loanId: "loan-1", loanComponent: null }), false);
});

test("loan components receive specific activity labels", () => {
  assert.equal(loanActivityLabel("disbursement"), "Loan started");
  assert.equal(loanActivityLabel("principal"), "Principal payment");
  assert.equal(loanActivityLabel("interest"), "Interest payment");
  assert.equal(loanActivityLabel("fee"), "Loan fee");
});
