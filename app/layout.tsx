import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { MenuProvider } from "@/lib/menu";
import Header from "@/components/Header";
import PageBoundary from "@/components/PageBoundary";

export const metadata: Metadata = {
  title: "Xu Noodles — Indo-Chinese Food Delivery",
  description: "Order Indo-Chinese food from Xu Noodles, delivered hot to your door. Pay on delivery with cash or UPI.",
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
            <PageBoundary name="header" compact>
              <Header />
            </PageBoundary>
            <PageBoundary name="page">{children}</PageBoundary>
          </CartProvider>
        </MenuProvider>
      </body>
    </html>
  );
}
