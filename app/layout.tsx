import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { MenuProvider } from "@/lib/menu";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Xu Noodles — Indo-Chinese Menu & Ordering",
  description: "Browse the Xu Noodles menu and place your order for dine-in or takeaway.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141111",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <MenuProvider>
          <CartProvider>
            <Header />
            {children}
          </CartProvider>
        </MenuProvider>
      </body>
    </html>
  );
}
