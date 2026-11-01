// Offer and price rules. These MUST match place_order in supabase/06_offers_and_sales.sql exactly,
// because the server refuses an order whose total differs from what the customer saw.

export type Offer = {
  id: string;
  title: string | null;
  type: "percent" | "flat";
  value: number;
  applies_to: "item" | "category" | "order";
  target: string | null; // dish id (item) or category as stored on dishes (category)
  min_order: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export type Applied = { offer: Offer; discount: number };

export const GST_PERCENT = 5;

// Whole-rupee maths only: (x * 5) / 100 avoids floating-point surprises like 290 * 0.05 = 14.4999….
export const gstOn = (amount: number) => Math.round((amount * GST_PERCENT) / 100);

export const isOfferLive = (o: Offer, now = Date.now()) =>
  o.is_active && now >= new Date(o.starts_at).getTime() && now <= new Date(o.ends_at).getTime();

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Same tie-break as the SQL: bigger discount first, then offer id as text.
const best = (list: Applied[]) =>
  list.filter((a) => a.discount > 0).sort((a, b) => b.discount - a.discount || (String(a.offer.id) < String(b.offer.id) ? -1 : 1))[0] ?? null;

// Per-unit discount on a dish price. A flat discount never takes a dish below ₹1.
export function unitDiscount(offer: Offer, price: number): number {
  const d = offer.type === "percent" ? Math.round((price * offer.value) / 100) : Math.min(offer.value, price - 1);
  return Math.max(0, d);
}

// The one offer that applies to a dish at this price: a dish offer beats a category offer.
export function dishOffer(dish: { id: string; categoryRaw: string }, price: number, offers: Offer[]): Applied | null {
  const forDish = offers.filter((o) => o.applies_to === "item" && String(o.target) === dish.id);
  const pick = best(forDish.map((offer) => ({ offer, discount: unitDiscount(offer, price) })));
  if (forDish.length) return pick; // a dish offer wins even if a category offer would be bigger
  const forCategory = offers.filter((o) => o.applies_to === "category" && norm(o.target) === norm(dish.categoryRaw));
  return best(forCategory.map((offer) => ({ offer, discount: unitDiscount(offer, price) })));
}

const orderDiscount = (offer: Offer, amount: number) =>
  Math.max(0, offer.type === "percent" ? Math.round((amount * offer.value) / 100) : Math.min(offer.value, amount));

// At most one order offer: the biggest discount among those whose minimum is met
// by the subtotal after dish discounts.
export function orderOffer(afterDishDiscounts: number, offers: Offer[]): Applied | null {
  return best(
    offers
      .filter((o) => o.applies_to === "order" && afterDishDiscounts >= (o.min_order ?? 0))
      .map((offer) => ({ offer, discount: orderDiscount(offer, afterDishDiscounts) })),
  );
}

// The next order offer the customer could unlock, if it is close and better than what they have.
export function nextOrderOffer(afterDishDiscounts: number, current: Applied | null, offers: Offer[]) {
  const candidates = offers
    .filter((o) => o.applies_to === "order" && (o.min_order ?? 0) > afterDishDiscounts)
    .map((offer) => ({ offer, gap: offer.min_order - afterDishDiscounts, discount: orderDiscount(offer, offer.min_order) }))
    .filter((c) => c.discount > (current?.discount ?? 0) && c.gap <= Math.max(150, c.offer.min_order * 0.4))
    .sort((a, b) => a.gap - b.gap);
  return candidates[0] ?? null;
}

// Short label for badges and lists: "20% off", "₹30 off".
// Never shows "NaN": an offer row with a missing value just reads "Offer".
export const offerBadge = (o: Pick<Offer, "type" | "value">) =>
  !Number.isFinite(o.value) ? "Offer" : o.type === "percent" ? `${o.value}% off` : `₹${o.value} off`;

// Banner text for order offers: "₹50 off on orders above ₹499".
export const orderOfferText = (o: Offer) =>
  Number.isFinite(o.min_order) && o.min_order > 0 ? `${offerBadge(o)} on orders above ₹${o.min_order}` : `${offerBadge(o)} on your order`;
