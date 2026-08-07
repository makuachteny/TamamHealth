/**
 * Route wrapper only.
 *
 * The registration form itself is a shared feature, not a page: the front
 * desk renders the same component inside its "Register new patient" dialog.
 * It used to live in this file and be imported as
 * `from '@/app/(dashboard)/patients/new/page'`, which made one route's page
 * module a dependency of another route — so this route now owns nothing but
 * the URL.
 */
import PatientRegistrationForm from '@/components/patients/registration/PatientRegistrationForm';

export default function NewPatientPage() {
  return <PatientRegistrationForm />;
}
