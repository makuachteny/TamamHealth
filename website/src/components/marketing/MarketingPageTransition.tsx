"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function MarketingPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="mk-route-transition">
      {children}
    </div>
  );
}
