import { redirect } from 'next/navigation';

export default function NurseWardPage() {
  redirect('/dashboard/nurse?station=ward');
}
