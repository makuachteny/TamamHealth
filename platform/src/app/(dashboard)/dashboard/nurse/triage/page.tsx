import { redirect } from 'next/navigation';

export default async function Page({ searchParams }: { searchParams: Promise<{ patient?: string }> }) {
  const params = await searchParams;
  const target = new URLSearchParams({ station: 'triage' });
  if (params.patient) target.set('patient', params.patient);
  redirect(`/dashboard/nurse?${target.toString()}`);
}
