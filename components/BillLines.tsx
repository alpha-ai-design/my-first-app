import { formatINR } from "@/lib/cart";
import { GST_PERCENT } from "@/lib/pricing";

// Subtotal, Offer discount, GST, Delivery fee, Total: shared by the cart and checkout.
export default function BillLines({
  subtotal,
  discount,
  gst,
  deliveryFee,
  total,
}: {
  subtotal: number;
  discount: number;
  gst: number;
  deliveryFee: number;
  total: number;
}) {
  return (
    <dl className="mt-2 space-y-1.5">
      <div className="flex justify-between">
        <dt className="text-stone-600">Subtotal</dt>
        <dd className="tabular-nums">{formatINR(subtotal)}</dd>
      </div>
      {discount > 0 && (
        <div className="flex justify-between font-semibold text-green-800">
          <dt>Offer discount</dt>
          <dd className="tabular-nums">−{formatINR(discount)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-stone-600">GST ({GST_PERCENT}%)</dt>
        <dd className="tabular-nums">{formatINR(gst)}</dd>
      </div>
      {deliveryFee > 0 && (
        <div className="flex justify-between">
          <dt className="text-stone-600">Delivery fee</dt>
          <dd className="tabular-nums">{formatINR(deliveryFee)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-dashed border-stone-300 pt-1.5 text-heading font-bold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatINR(total)}</dd>
      </div>
    </dl>
  );
}
