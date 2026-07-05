/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Root Entry Point
   Redirects to the public story/landing page (staff sign-in is linked
   from its header and footer).
   ═══════════════════════════════════════════════════════════════════ */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/product");
}
