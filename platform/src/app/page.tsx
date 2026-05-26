/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Root Entry Point
   Redirects to the login page.
   ═══════════════════════════════════════════════════════════════════ */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
