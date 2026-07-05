/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Root Entry Point
   Redirects to staff sign-in. Already-authenticated users are bounced
   to their dashboard from the login page itself.
   ═══════════════════════════════════════════════════════════════════ */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
