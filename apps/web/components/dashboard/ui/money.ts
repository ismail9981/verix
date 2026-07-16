/* Shared money formatting — one canonical implementation so every feature's
   amounts render consistently (whole-currency-unit amounts collapse to no
   decimals, e.g. "$150" rather than "$150.00"). */
export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
