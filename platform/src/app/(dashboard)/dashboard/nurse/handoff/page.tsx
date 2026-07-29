import { redirect } from 'next/navigation';

export default function NurseHandoffPage() {
  redirect('/dashboard/nurse?station=handoff');
}
