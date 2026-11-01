"use client";

import { usePathname } from "next/navigation";
import ErrorBoundary from "./ErrorBoundary";

// Error boundary for a whole page area. After a crash it tries again on the next navigation,
// so one broken page doesn't stay broken; working pages are never remounted by it.
export default function PageBoundary({ name, children, compact }: { name: string; children: React.ReactNode; compact?: boolean }) {
  const pathname = usePathname() ?? "";
  return (
    <ErrorBoundary resetKey={pathname} name={name} compact={compact}>
      {children}
    </ErrorBoundary>
  );
}
