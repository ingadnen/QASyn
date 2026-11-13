/**
 * Builds a PayPal checkout URL for both classic webscr buttons and paypal.me
 * links. The base URL is configured by the Super Admin.
 */
export function buildPaypalCheckoutUrl(input: {
  baseUrl?: string | null;
  recipientEmail: string;
  itemName: string;
  amount: number;
  currency: string;
}): string {
  const base = String(input.baseUrl || "https://www.paypal.com/cgi-bin/webscr").trim();
  const amount = Math.max(0, Number(input.amount) || 0).toFixed(2);
  const currency = String(input.currency || "USD").toUpperCase();

  if (/^https?:\/\/(www\.)?paypal\.me\//i.test(base)) {
    return `${base.replace(/\/+$/, "")}/${amount}${currency}`;
  }

  const separator = base.includes("?") ? "&" : "?";
  const params = new URLSearchParams({
    cmd: "_xclick",
    business: input.recipientEmail,
    item_name: input.itemName,
    amount,
    currency_code: currency,
  });
  return `${base}${separator}${params.toString()}`;
}
