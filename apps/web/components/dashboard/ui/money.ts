/*
 * Shared money formatting — one canonical implementation so every feature's
 * amounts render consistently (whole-currency-unit amounts collapse to no
 * decimals, e.g. "$150" rather than "$150.00").
 *
 * `cents` is always assumed to be 1/100th of the display unit (i.e. every
 * currency this app stores is 2-decimal). That assumption is safe today
 * because every currency selectable anywhere in the product (Settings'
 * workspace currency dropdown — see business-profile/mock-data.ts's
 * CURRENCIES) is a real 2-decimal ISO currency (USD/EUR/GBP/CAD/AUD). If a
 * 0-decimal currency (e.g. JPY) or a 3-decimal one (e.g. BHD) is ever added to
 * that list, both this function and every `Math.round(amount * 100)` write
 * path (reservation.service.ts, rental-unit.service.ts) need to convert using
 * that currency's actual minor-unit digit count instead of the hardcoded 100.
 */
export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
