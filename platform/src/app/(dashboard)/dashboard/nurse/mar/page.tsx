import { redirect } from 'next/navigation';

export default function NurseMarPage() {
  redirect('/dashboard/nurse?station=mar');
}
