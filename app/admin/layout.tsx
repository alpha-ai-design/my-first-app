import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Xu Kitchen",
  robots: { index: false, follow: false },
  // Installable as its own app ("Add to Home Screen"), needed for push notifications on iPhone.
  manifest: "/admin.webmanifest",
  icons: { icon: "/icons/xu-kitchen-192.png", apple: "/icons/xu-kitchen-apple-180.png" },
  appleWebApp: { capable: true, title: "Xu Kitchen", statusBarStyle: "black" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
