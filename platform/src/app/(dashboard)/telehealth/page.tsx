import { redirect } from 'next/navigation';

/* The telehealth screen was merged into the appointments page: telehealth
   visits render on the appointments calendar and "New Session" books them
   from there. Only the live visit room (./visit/[appointmentId]) remains.
   This stub keeps old links and bookmarks working. */
export default function TelehealthRedirect() {
  redirect('/appointments');
}
