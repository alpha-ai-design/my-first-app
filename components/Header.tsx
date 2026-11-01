"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { useCart } from "@/lib/cart";

export default function Header() {
  // All hooks first, unconditionally, in the same order on every render.
  const { count, hydrated } = useCart();
  const pathname = usePathname() ?? "";
  // The kitchen screens under /admin have their own header.
  if (pathname.startsWith("/admin")) return null;
  return (
    <header className="sticky top-0 z-30 bg-ink border-b-2 border-gold/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" aria-label="Xu Noodles home" className="flex min-h-10 items-center">
          <Logo />
        </Link>
        <Link
          href="/cart"
          className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label={`View cart, ${count} items`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.76L21 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9.5" cy="20" r="1.4" />
            <circle cx="17.5" cy="20" r="1.4" />
          </svg>
          {hydrated && count > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[12px] font-bold text-ink">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
