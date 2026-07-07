/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Root Entry Point
   Redirects straight to staff sign-in — this is a clinical EHR, not a
   marketing site.
   ═══════════════════════════════════════════════════════════════════ */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
