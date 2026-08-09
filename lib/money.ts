export const MONEY_DECIMAL_PLACES = 2;
export const MONEY_SCALE = 10 ** MONEY_DECIMAL_PLACES;

function assertFinite(value: number) {
  if (!Number.isFinite(value)) throw new Error("Money amount must be finite");
}

export function toMoneyCents(value: number) {
  assertFinite(value);
  const cents = Math.round((value + Math.sign(value) * Number.EPSILON) * MONEY_SCALE);
  if (!Number.isSafeInteger(cents)) throw new Error("Money amount is out of range");
  return cents;
}

export function fromMoneyCents(cents: number) {
  if (!Number.isSafeInteger(cents)) throw new Error("Money amount is out of range");
  const value = cents / MONEY_SCALE;
  return Object.is(value, -0) ? 0 : value;
}

export function normalizeMoney(value: number) {
  return fromMoneyCents(toMoneyCents(value));
}

export function addMoney(...values: number[]) {
  return fromMoneyCents(values.reduce((total, value) => total + toMoneyCents(value), 0));
}

export function subtractMoney(value: number, amount: number) {
  return fromMoneyCents(toMoneyCents(value) - toMoneyCents(amount));
}

export function sumMoney(values: number[]) {
  return addMoney(...values);
}
