"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDateTimeIST } from "@/lib/admin/ist";
import { fetchOrder, type AdminOrder } from "@/lib/admin/orders";
import { formatINR } from "@/lib/cart";

// Print-friendly bill. Narrow column so it fits 58/80 mm receipt printers; prints fine on A4 too.
export default function PrintBillPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<AdminOrder | null | undefined>(undefined);

  useEffect(() => {
    fetchOrder(id)
      .then(setOrder)
      .catch((err) => {
        console.error("Could not load order", err);
        setOrder(null);
      });
  }, [id]);

  // Open the print dialog as soon as the bill is on screen.
  useEffect(() => {
    if (order) setTimeout(() => window.print(), 300);
  }, [order]);

  if (order === undefined) return <p className="p-6">Loading bill…</p>;
  if (order === null) return <p className="p-6">Couldn&apos;t load this order.</p>;

  const fee = Number(order.delivery_fee);
  const row = "flex justify-between gap-2";

  return (
    <div className="receipt-page min-h-dvh bg-white py-4 text-black">
      <div className="no-print mx-auto mb-4 flex max-w-[80mm] gap-2 px-2">
        <button type="button" onClick={() => window.print()} className="min-h-12 flex-1 rounded-xl bg-ink text-lg font-bold text-white">
          Print
        </button>
        <button type="button" onClick={() => window.close()} className="min-h-12 flex-1 rounded-xl border-2 border-ink text-lg font-bold">
          Close
        </button>
      </div>

      <article className="receipt mx-auto max-w-[80mm] px-2 font-mono text-[13px] leading-snug">
        <h1 className="text-center text-xl font-extrabold">Xu Noodles</h1>
        <p className="text-center">Delivery bill</p>
        <hr className="my-2 border-dashed border-black" />
        <p className="text-base font-extrabold">Order #{order.order_number}</p>
        <p>{formatDateTimeIST(order.created_at)} IST</p>
        <hr className="my-2 border-dashed border-black" />
        <p className="font-bold">{order.customer_name}</p>
        <p>+91 {order.customer_phone}</p>
        <p>
          Flat {order.flat_number}, {order.tower}
        </p>
        <p>{order.society}</p>
        {order.landmark && <p>Landmark: {order.landmark}</p>}
        <hr className="my-2 border-dashed border-black" />
        <ul className="space-y-1">
          {order.order_items.map((i) => (
            <li key={i.id}>
              <div className={row}>
                <span>
                  {i.name}
                  {i.portion && ` (${i.portion === "half" ? "Half" : "Full"})`}
                </span>
              </div>
              <div className={row}>
                <span>
                  {i.quantity} × {formatINR(Number(i.unit_price))}
                </span>
                <span>{formatINR(Number(i.unit_price) * i.quantity)}</span>
              </div>
            </li>
          ))}
        </ul>
        {order.notes && (
          <>
            <hr className="my-2 border-dashed border-black" />
            <p className="font-bold">Cooking instructions:</p>
            <p>{order.notes}</p>
          </>
        )}
        <hr className="my-2 border-dashed border-black" />
        <div className={row}>
          <span>Subtotal</span>
          <span>{formatINR(Number(order.subtotal))}</span>
        </div>
        <div className={row}>
          <span>GST (5%)</span>
          <span>{formatINR(Number(order.gst))}</span>
        </div>
        {fee > 0 && (
          <div className={row}>
            <span>Delivery fee</span>
            <span>{formatINR(fee)}</span>
          </div>
        )}
        <div className={`${row} mt-1 border-t border-black pt-1 text-base font-extrabold`}>
          <span>Total</span>
          <span>{formatINR(Number(order.total))}</span>
        </div>
        <hr className="my-2 border-dashed border-black" />
        <p className="text-center font-bold">Pay on delivery: cash or UPI</p>
        <p className="mt-1 text-center">Thank you!</p>
      </article>
    </div>
  );
}
