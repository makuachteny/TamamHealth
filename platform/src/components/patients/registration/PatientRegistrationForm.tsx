'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Camera } from '@/components/icons/lucide';
import FingerprintCapture, { type CapturedFingerprint } from '@/components/FingerprintCapture';
import PhotoCaptureModal from '@/components/patients/PhotoCaptureModal';
import { statesAndCounties, states, tribes, languages } from '@/data/mock';
import { usePatients } from '@/lib/hooks/usePatients';
import { useAuth } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { enrollFingerprint } from '@/lib/services/fingerprint-service';
import { isValidPhone, isValidEmail, isValidNationalId, normalizePhone, normalizeEmail, normalizeNationalId } from '@/lib/field-formats';
import { isPathAllowed } from '@/lib/role-routes';
import Select from '@/components/Select';
import RegistrationProgressRail from './RegistrationProgressRail';
import RegistrationReview from './RegistrationReview';
import { buildReviewGroups } from './review-groups';
import {
  SECTION_ANCHORS, REVIEW_SECTION, scrollParentOf, sectionRequirementProgress,
} from './registration-progress';

interface PatientRegistrationFormProps {
  embedded?: boolean;
  onCancel?: () => void;
  onRegistered?: () => void;
}


export function PatientRegistrationForm({ embedded = false, onCancel, onRegistered }: PatientRegistrationFormProps = {}) {
  const { t } = useTranslation();
  // Memoized because the review read-back is derived from it — a fresh array
  // each render would rebuild that on every keystroke.
  const steps = useMemo(() => [
    t('patientNew.stepDemographics'), t('patientNew.stepContactLocation'),
    t('patientNew.stepNextOfKin'), t('patientNew.stepBiometrics'),
    t('patientNew.stepPaymentCoverage'), t('patientNew.stepReview'),
  ], [t]);
  // Short per-step hint shown once in the card header. Previously each step
  // also rendered its own section header with a near-duplicate title, so the
  // heading appeared twice ("Demographics" / "Patient Demographics"). The note
  const relationshipOptions = [
    { value: 'Spouse', labelKey: 'patientNew.relSpouse' },
    { value: 'Parent', labelKey: 'patientNew.relParent' },
    { value: 'Child', labelKey: 'patientNew.relChild' },
    { value: 'Sibling', labelKey: 'patientNew.relSibling' },
    { value: 'Uncle', labelKey: 'patientNew.relUncle' },
    { value: 'Aunt', labelKey: 'patientNew.relAunt' },
    { value: 'Cousin', labelKey: 'patientNew.relCousin' },
    { value: 'Friend', labelKey: 'patientNew.relFriend' },
    { value: 'Other', labelKey: 'patientNew.relOther' },
  ];
  const router = useRouter();
  const { create: createPatient } = usePatients();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  // "Register & check in" hands off to the appointments page's walk-in dialog.
  // Roles that can register a patient but cannot book (lab, pharmacy, records,
  // nutrition, radiology) would only land on Access Restricted, so they don't
  // get the button.
  const canCheckIn = isPathAllowed(currentUser?.role || '', '/appointments');
  const [form, setForm] = useState({
    firstName: '', middleName: '', surname: '', maidenName: '',
    dateOfBirth: '', estimatedAge: '', gender: '', tribe: '', primaryLanguage: '',
    phone: '', altPhone: '', whatsapp: '', email: '',
    state: '', county: '', payam: '', boma: '', bomaCode: '', householdNumber: '', address: '',
    nationalId: '',
    nokName: '', nokRelationship: '', nokPhone: '', nokAddress: '',
    payorCoverageType: 'out-of-pocket' as 'out-of-pocket' | 'program' | 'exemption' | 'ngo',
    payorProgram: '', payorNgo: '', payorExemptionReason: '', payorExemptionOther: '',
  });

  type AdditionalNok = { name: string; relationship: string; phone: string; address: string };
  const [additionalNok, setAdditionalNok] = useState<AdditionalNok[]>([]);
  const addNokEntry = () => setAdditionalNok(rs => rs.length < 3 ? [...rs, { name: '', relationship: '', phone: '', address: '' }] : rs);
  const updateNokEntry = (i: number, patch: Partial<AdditionalNok>) => {
    setAdditionalNok(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
    if ('phone' in patch && errors[`additionalNok.${i}.phone`]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[`additionalNok.${i}.phone`];
        return next;
      });
    }
  };
  const removeNokEntry = (i: number) => setAdditionalNok(rs => rs.filter((_, j) => j !== i));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  /** Sections whose fields failed the last submit — flagged in the rail. */
  const [errorSections, setErrorSections] = useState<Set<number>>(new Set());
  const [submitIntent, setSubmitIntent] = useState<'profile' | 'check-in' | null>(null);
  // Fingerprint templates captured during registration (consent-gated inside
  // the component). Persisted AFTER the patient doc exists, in handleSubmit.
  const [fingerprints, setFingerprints] = useState<CapturedFingerprint[]>([]);
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  /**
   * Review is a step, not a section. It used to sit at the bottom of the form
   * from the moment the page opened, so the clerk scrolled past a summary of
   * fields they had not filled yet — a card reading "DOB: ~ years / Gender:"
   * before they had typed a name. It now replaces the form once everything
   * required is answered, and reads back every field rather than a digest.
   */
  const [reviewMode, setReviewMode] = useState(false);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push('/patients');
  };

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const updateCoverageType = (value: typeof form.payorCoverageType) => {
    setForm(prev => ({
      ...prev,
      payorCoverageType: value,
      payorProgram: value === 'program' ? prev.payorProgram : '',
      payorNgo: value === 'ngo' ? prev.payorNgo : '',
      payorExemptionReason: value === 'exemption' ? prev.payorExemptionReason : '',
      payorExemptionOther: value === 'exemption' ? prev.payorExemptionOther : '',
    }));
  };

  const updateExemptionReason = (value: string) => {
    setForm(prev => ({
      ...prev,
      payorExemptionReason: value,
      payorExemptionOther: value === 'Other' ? prev.payorExemptionOther : '',
    }));
  };
  // ── Rail progress ────────────────────────────────────────────────────
  // What each section still needs, mirroring `validateStep` exactly — the rail
  // must count the same things the Register button refuses to submit without,
  // or it promises a section is finished and then the submit bounces off it.
  // Sections with nothing required (biometrics, coverage, review) report a
  // total of 0 and read as optional rather than as permanently unfinished.
  const sectionProgress = useMemo(() => sectionRequirementProgress(form), [form]);

  const requiredDone = sectionProgress.reduce((sum, s) => sum + s.done, 0);
  const requiredTotal = sectionProgress.reduce((sum, s) => sum + s.total, 0);

  // Which section the clerk is currently looking at. The rail's filled spine
  // says how much of the form is done; this says where they are in it — two
  // different questions a long single-page form has to answer at once.
  const [activeSection, setActiveSection] = useState(0);
  useEffect(() => {
    const sections = SECTION_ANCHORS
      .map(anchor => document.getElementById(`reg-${anchor}`))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    // A narrow band near the top of the viewport is "current". Without it every
    // section on screen counts and the marker sits on whichever happens to be
    // last in the callback.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const firstVisible = SECTION_ANCHORS.findIndex(a => visible.has(`reg-${a}`));
      if (firstVisible >= 0) setActiveSection(firstVisible);
      // Observe against whatever actually scrolls. This form is also embedded
      // in the front desk's registration dialog, where the page never scrolls
      // and the modal body does — measured against the viewport there, no
      // section ever entered the band and the marker stayed stuck on the first.
    }, { root: scrollParentOf(sections[0]), rootMargin: '-12% 0px -72% 0px' });

    sections.forEach(el => observer.observe(el));
    return () => observer.disconnect();
    // Re-bound when review opens or closes: the sections unmount behind the
    // review page, so an observer set up once would come back holding six
    // detached nodes and the marker would stop following the scroll.
  }, [reviewMode]);

  const counties = form.state ? statesAndCounties[form.state] || [] : [];

  const geocodeId = form.bomaCode && form.householdNumber
    ? `BOMA-${form.bomaCode.toUpperCase()}-HH${form.householdNumber}`
    : undefined;

  /**
   * Every field the form collects, read back under its own section heading.
   *
   * Labels are the form's own keys rather than review-specific ones, so the
   * review says the same words the field said and there is nothing new left
   * untranslated in the ten non-English locales.
   */
  const reviewGroups = useMemo(() => buildReviewGroups(steps, {
    form,
    additionalNok,
    fingerprintCount: fingerprints.length,
    geocodeId,
  }, t), [steps, form, additionalNok, fingerprints, geocodeId, t]);

  // Validate current step before allowing navigation
  const validateStep = (s: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!form.firstName.trim()) errs.firstName = t('patientNew.errFirstNameRequired');
      if (!form.surname.trim()) errs.surname = t('patientNew.errSurnameRequired');
      if (!form.gender) errs.gender = t('patientNew.errGenderRequired');
      if (!form.dateOfBirth && !form.estimatedAge) errs.dateOfBirth = t('patientNew.errDobRequired');
      if (form.estimatedAge) {
        const age = parseInt(form.estimatedAge, 10);
        if (isNaN(age) || age < 0 || age > 150) errs.estimatedAge = t('patientNew.errAgeRange');
      }
      if (!form.primaryLanguage) errs.primaryLanguage = t('patientNew.errPrimaryLanguageRequired');
    } else if (s === 1) {
      if (!form.state) errs.state = t('patientNew.errStateRequired');
      if (form.state && !form.county) errs.county = t('patientNew.errCountyRequired');
      // Phone/altPhone/whatsapp are optional — only flag a non-empty malformed
      // value (isValidPhone returns true for empty).
      if (!isValidPhone(form.phone)) errs.phone = t('validation.errPhone');
      if (!isValidPhone(form.altPhone)) errs.altPhone = t('validation.errPhone');
      if (!isValidPhone(form.whatsapp)) errs.whatsapp = t('validation.errPhone');
      // Optional like the phones — isValidEmail returns true for empty, so
      // this only flags something the clerk actually typed wrong.
      if (!isValidEmail(form.email)) errs.email = t('validation.errEmail');
      if (!isValidNationalId(form.nationalId)) errs.nationalId = t('validation.errNationalId');
    } else if (s === 2) {
      if (!form.nokName.trim()) errs.nokName = t('patientNew.errNokNameRequired');
      if (!form.nokRelationship) errs.nokRelationship = t('patientNew.errRelationshipRequired');
      if (!form.nokPhone.trim()) errs.nokPhone = t('patientNew.errNokPhoneRequired');
      else if (!isValidPhone(form.nokPhone)) errs.nokPhone = t('validation.errPhone');
      additionalNok.forEach((nok, index) => {
        if (nok.phone && !isValidPhone(nok.phone)) {
          errs[`additionalNok.${index}.phone`] = t('validation.errPhone');
        }
      });
    }
    return errs;
  };

  /**
   * Validate every section. On failure this also does the surfacing — flags the
   * offending sections in the rail, leaves the form visible and scrolls to the
   * first field that needs attention — and returns false.
   *
   * Shared by Review and Register: the two entry points must agree on what
   * "finished" means, or Review would wave through a form that Register then
   * refuses. Which section each failure belongs to matters because the buttons
   * live in the rail and the offending field can be two screens down; without
   * it, pressing the button looked like it did nothing at all.
   */
  const validateAll = (): boolean => {
    const perSection = [validateStep(0), validateStep(1), validateStep(2)];
    const allErrors = Object.assign({}, ...perSection);
    if (Object.keys(allErrors).length === 0) {
      setErrorSections(new Set());
      return true;
    }
    setErrors(allErrors);
    const failed = perSection
      .map((errs, i) => (Object.keys(errs).length > 0 ? i : -1))
      .filter(i => i >= 0);
    setErrorSections(new Set(failed));
    // A failure found from the review page has to put the form back on screen,
    // otherwise the scroll below targets a section that is not rendered.
    setReviewMode(false);
    showToast(t('patientNew.toastFillRequired'), 'error');
    const firstField = Object.keys(perSection[failed[0]])[0];
    // Deferred a frame: when we have just come back from review the form is
    // still being mounted, and scrollIntoView on a detached node does nothing.
    requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>(`[data-field="${firstField}"]`) ??
        document.getElementById(`reg-${SECTION_ANCHORS[failed[0]]}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return false;
  };

  /** Rail click: leave review (if in it) and jump to that section. */
  const goToSection = (i: number) => {
    setActiveSection(i);
    if (!reviewMode) {
      document.getElementById(`reg-${SECTION_ANCHORS[i]}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setReviewMode(false);
    requestAnimationFrame(() => {
      document.getElementById(`reg-${SECTION_ANCHORS[i]}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  /** Rail's Review step: only opens once the form would actually submit. */
  const openReview = () => {
    if (!validateAll()) return;
    setErrors({});
    setReviewMode(true);
    setActiveSection(SECTION_ANCHORS.length - 1);
    // Whichever container scrolls — the page, or the front desk dialog's body.
    const scroller = scrollParentOf(document.getElementById(`reg-${SECTION_ANCHORS[0]}`));
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (nextAction: 'profile' | 'check-in' = 'profile') => {
    if (!validateAll()) return;

    setSubmitting(true);
    setSubmitIntent(nextAction);
    try {
      const nowIso = new Date().toISOString();
      const today = nowIso.split('T')[0];
      // Normalize structured fields to canonical form before persisting so the
      // stored value (and any review screen) matches the platform standard.
      // patient-service re-normalizes, but normalizing here keeps the in-form
      // state canonical too.
      const normPhone = normalizePhone(form.phone) ?? form.phone;
      const normAltPhone = normalizePhone(form.altPhone) ?? form.altPhone;
      const normWhatsapp = normalizePhone(form.whatsapp) ?? form.whatsapp;
      const normNokPhone = normalizePhone(form.nokPhone) ?? form.nokPhone;
      const normNationalId = normalizeNationalId(form.nationalId);
      const normEmail = normalizeEmail(form.email);
      const exemptionReason = form.payorCoverageType === 'exemption'
        ? (form.payorExemptionReason === 'Other' ? form.payorExemptionOther.trim() : form.payorExemptionReason)
        : '';
      const result = await createPatient({
        hospitalNumber: '',
        geocodeId,
        householdNumber: form.householdNumber && !isNaN(parseInt(form.householdNumber, 10)) ? parseInt(form.householdNumber, 10) : undefined,
        nationalId: normNationalId || undefined,
        bomaCode: form.bomaCode || undefined,
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        surname: form.surname.trim(),
        maidenName: form.maidenName.trim(),
        dateOfBirth: form.dateOfBirth,
        estimatedAge: form.estimatedAge && !isNaN(parseInt(form.estimatedAge, 10)) ? parseInt(form.estimatedAge, 10) : undefined,
        gender: form.gender as 'Male' | 'Female',
        tribe: form.tribe,
        primaryLanguage: form.primaryLanguage,
        phone: normPhone,
        altPhone: normAltPhone,
        whatsapp: normWhatsapp,
        // Omitted rather than stored empty, so `patient.email` being set is a
        // reliable test for "can we email this patient".
        email: normEmail || undefined,
        state: form.state,
        county: form.county,
        payam: form.payam,
        boma: form.boma,
        address: form.address,
        nokName: form.nokName,
        nokRelationship: form.nokRelationship,
        nokPhone: normNokPhone,
        nokAddress: form.nokAddress,
        ...(additionalNok.filter(n => n.name.trim()).length > 0 ? {
          additionalNextOfKin: additionalNok.filter(n => n.name.trim()).map(n => ({
            name: n.name.trim(),
            relationship: n.relationship,
            phone: normalizePhone(n.phone) ?? n.phone,
            address: n.address || undefined,
          })),
        } : {}),
        payorInfo: {
          coverageType: form.payorCoverageType,
          ...(form.payorProgram ? { programEnrollment: form.payorProgram } : {}),
          ...(form.payorNgo ? { ngoName: form.payorNgo } : {}),
          ...(exemptionReason ? { exemptionReason } : {}),
        },
        bloodType: 'Unknown',
        allergies: ['None known'],
        chronicConditions: ['None'],
        ...(patientPhotoUrl ? { photoUrl: patientPhotoUrl } : {}),
        registrationHospital: currentUser?.hospitalId || '',
        registrationDate: today,
        registeredAt: nowIso,
        registeredBy: currentUser?.name || currentUser?.username || '',
        lastVisitDate: today,
        lastVisitHospital: currentUser?.hospitalId || '',
        isActive: true,
      });
      // Persist fingerprint enrollments now that the patient _id exists.
      // Best-effort: a biometric failure must never roll back registration.
      if (fingerprints.length > 0 && result?._id) {
        // Consent must be attributable to a real staff member — no anonymous
        // fallback. Without an identified user we skip enrollment entirely.
        const consentRecordedBy = currentUser?.name || currentUser?.username;
        try {
          if (!consentRecordedBy) throw new Error('no authenticated user to record consent');
          for (const fp of fingerprints) {
            await enrollFingerprint({
              patientId: result._id,
              patientName: `${form.firstName.trim()} ${form.surname.trim()}`,
              finger: fp.finger,
              template: fp.template,
              format: fp.format,
              quality: fp.quality,
              driver: fp.driver,
              consentRecordedBy,
              enrolledBy: currentUser?.username,
              hospitalId: currentUser?.hospitalId,
              orgId: result.orgId,
            });
          }
        } catch (fpErr) {
          console.error('Fingerprint enrollment failed:', fpErr);
          showToast(t('fingerprint.enrollFailed'), 'error');
        }
      }
      showToast(`${t('patientNew.toastRegistered', { firstName: form.firstName, surname: form.surname })}${result?.hospitalNumber ? t('patientNew.hospitalNumberSuffix', { number: result.hospitalNumber }) : ''}`, 'success');
      if (onRegistered) {
        onRegistered();
      } else if (nextAction === 'check-in' && result?._id) {
        // The standalone Check-In module is retired — a patient is checked in
        // from an appointment. Someone registered at the window has none, so
        // this hands off to the walk-in dialog (see the ?walkIn= deep link on
        // the appointments page), which books today's slot already checked in.
        router.push(`/appointments?walkIn=${result._id}`);
      } else {
        router.push('/patients');
      }
    } catch (err) {
      console.error('Failed to register patient:', err);
      if (err instanceof Error && 'fields' in err) {
        const validationErr = err as Error & { fields: Record<string, string> };
        setErrors(validationErr.fields);
        showToast(t('patientNew.toastValidationFailed', { errors: Object.values(validationErr.fields).join(', ') }), 'error');
      } else {
        showToast(t('patientNew.toastRegisterFailed'), 'error');
      }
    } finally {
      setSubmitting(false);
      setSubmitIntent(null);
    }
  };

  return (
    <>
      <main className={`page-container page-enter patient-registration-page${embedded ? ' patient-registration-page--embedded' : ''}`}>
        {!embedded && (
          <div className="patient-registration-toolbar">
          <button onClick={() => router.push('/patients')} className="patient-registration-back">
            <ArrowLeft className="w-4 h-4" /> {t('patientNew.backToPatients')}
          </button>
          </div>
        )}

        <div className="omrs-reg">
        {/* Left rail: the form's table of contents and its two actions. The
            wizard's step dots are gone — every section is on the page now, so
            the rail jumps between them rather than gating them. */}
        <aside className="omrs-reg-rail" aria-label={t('patientNew.registrationProgressAriaLabel')}>
          <h1 className="omrs-reg-title">{t('patientNew.topBarTitle')}</h1>
          {/* Said once, here, instead of under all five section headings —
              where it repeated a sentence the clerk had already read and
              claimed "all fields required" of Biometrics and Coverage, which
              require nothing. */}
          <p className="omrs-reg-railnote">{t('patientNew.requiredFieldsNote')}</p>
          <p className="omrs-reg-jump">{t('patientNew.jumpTo')}</p>
          <RegistrationProgressRail
            steps={steps}
            sectionProgress={sectionProgress}
            requiredDone={requiredDone}
            requiredTotal={requiredTotal}
            activeSection={activeSection}
            errorSections={errorSections}
            onSelectSection={goToSection}
            onOpenReview={openReview}
            optionalLabel={t('patientNew.optionalLabel')}
          />
          <div className="omrs-reg-railactions">
            {/* Filling and committing are different moments, so they get
                different buttons. While the form is open the primary action is
                Review; the registering actions only appear on the read-back,
                where the clerk can see what they are about to commit. */}
            {!reviewMode ? (
              <button
                type="button"
                onClick={openReview}
                disabled={submitting}
                className="btn btn-primary"
              >
                {t('patientNew.stepReview')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSubmit('profile')}
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting && submitIntent === 'profile'
                    ? t('patientNew.saving')
                    : t('patientNew.registerPatient')}
                </button>
                {!onRegistered && canCheckIn && (
                  <button
                    type="button"
                    onClick={() => handleSubmit('check-in')}
                    disabled={submitting}
                    className="btn btn-secondary"
                  >
                    {submitting && submitIntent === 'check-in'
                      ? t('patientNew.saving')
                      : t('patientNew.registerAndCheckIn')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => goToSection(0)}
                  disabled={submitting}
                  className="btn btn-secondary"
                >
                  {t('action.back')}
                </button>
              </>
            )}
            <button type="button" onClick={handleCancel} className="omrs-reg-cancel">
              {t('patientNew.cancel')}
            </button>
          </div>
        </aside>

        <div className="patient-registration-shell omrs-reg-form">
          <div className="patient-registration-card-body">
            {/* Sections 0–4 are the form itself; Review below replaces them
                rather than sitting underneath, so the clerk never scrolls
                through a summary of fields they have not filled yet. */}
            {!reviewMode && (<>
            {/* Step 0: Demographics */}
            {(
              <section className="registration-section omrs-reg-section" id="reg-demographics">
                <header className="omrs-reg-sectionhead">
                  <h2>1. {steps[0]}</h2>
                  <p>{t('patientNew.requiredFieldsNote')}</p>
                </header>
                <div className="omrs-reg-fields">
                <div className="registration-field-grid registration-field-grid--three">
                  <div>
                    <label htmlFor="pt-firstName">{t('patientNew.firstName')}</label>
                    <input id="pt-firstName" type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder={t('patientNew.firstNamePlaceholder')} aria-required="true" aria-invalid={!!errors.firstName} style={errors.firstName ? { borderColor: 'var(--color-danger)' } : {}} />
                    {errors.firstName && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.firstName}</p>}
                  </div>
                  <div>
                    <label htmlFor="pt-middleName">{t('patientNew.middleName')}</label>
                    <input id="pt-middleName" type="text" value={form.middleName} onChange={e => update('middleName', e.target.value)} placeholder={t('patientNew.middleNamePlaceholder')} />
                  </div>
                  <div>
                    <label htmlFor="pt-surname">{t('patientNew.surname')}</label>
                    <input id="pt-surname" type="text" value={form.surname} onChange={e => update('surname', e.target.value)} placeholder={t('patientNew.surnamePlaceholder')} aria-required="true" aria-invalid={!!errors.surname} style={errors.surname ? { borderColor: 'var(--color-danger)' } : {}} />
                    {errors.surname && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.surname}</p>}
                  </div>
                </div>
                <div className="registration-field-grid registration-field-grid--three">
                  <div>
                    <label htmlFor="pt-maidenName">{t('patientNew.maidenName')}</label>
                    <input id="pt-maidenName" type="text" value={form.maidenName} onChange={e => update('maidenName', e.target.value)} placeholder={t('patientNew.maidenNamePlaceholder')} />
                  </div>
                  <div>
                    <label htmlFor="pt-dob">{t('patientNew.dateOfBirth')} {!form.estimatedAge && '*'}</label>
                    <input id="pt-dob" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} aria-invalid={!!errors.dateOfBirth} style={errors.dateOfBirth ? { borderColor: 'var(--color-danger)' } : {}} />
                    {errors.dateOfBirth && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.dateOfBirth}</p>}
                  </div>
                  <div>
                    <label htmlFor="pt-estimatedAge">{t('patientNew.estimatedAge')}</label>
                    <input id="pt-estimatedAge" type="number" value={form.estimatedAge} onChange={e => update('estimatedAge', e.target.value)} placeholder={t('patientNew.estimatedAgePlaceholder')} />
                  </div>
                </div>
                <div className="registration-field-grid registration-field-grid--three">
                  <div>
                    <label htmlFor="pt-gender">{t('patientNew.gender')}</label>
                    <Select id="pt-gender" value={form.gender} onChange={e => update('gender', e.target.value)} aria-required="true" aria-invalid={!!errors.gender} style={errors.gender ? { borderColor: 'var(--color-danger)' } : {}}>
                      <option value="">{t('patientNew.selectGender')}</option>
                      <option value="Male">{t('patient.male')}</option>
                      <option value="Female">{t('patient.female')}</option>
                    </Select>
                    {errors.gender && <p className="text-[11px] mt-1" style={{ color: 'var(--color-danger)' }}>{errors.gender}</p>}
                  </div>
                  <div>
                    <label htmlFor="pt-tribe">{t('patientNew.tribe')}</label>
                    <Select id="pt-tribe" value={form.tribe} onChange={e => update('tribe', e.target.value)}>
                      <option value="">{t('patientNew.selectTribe')}</option>
                      {tribes.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="pt-language">{t('patientNew.primaryLanguage')} *</label>
                    <Select id="pt-language" value={form.primaryLanguage} onChange={e => update('primaryLanguage', e.target.value)} aria-required="true" aria-invalid={!!errors.primaryLanguage} style={errors.primaryLanguage ? { borderColor: 'var(--color-danger)' } : {}}>
                      <option value="">{t('patientNew.selectLanguage')}</option>
                      {languages.map(l => <option key={l} value={l}>{l}</option>)}
                    </Select>
                    {errors.primaryLanguage && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.primaryLanguage}</p>}
                  </div>
                </div>
                </div>
              </section>
            )}

            {/* Step 1: Contact & Location */}
            {(
              <section className="registration-section omrs-reg-section" id="reg-contact">
                <header className="omrs-reg-sectionhead">
                  <h2>2. {steps[1]}</h2>
                  <p>{t('patientNew.requiredFieldsNote')}</p>
                </header>
                <div className="omrs-reg-fields">
                <div className="registration-field-grid registration-field-grid--three">
                  <div>
                    <label htmlFor="pt-phone">{t('patientNew.phone')}</label>
                    <input id="pt-phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder={t('patientNew.phonePlaceholder')} aria-invalid={!!errors.phone} style={errors.phone ? { borderColor: 'var(--color-danger)' } : {}} />
                    {errors.phone && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.phone}</p>}
                  </div>
                  <div>
                    <label htmlFor="pt-altPhone">{t('patientNew.altPhone')}</label>
                    <input id="pt-altPhone" type="tel" value={form.altPhone} onChange={e => update('altPhone', e.target.value)} placeholder={t('patientNew.altPhonePlaceholder')} aria-invalid={!!errors.altPhone} style={errors.altPhone ? { borderColor: 'var(--color-danger)' } : {}} />
                    {errors.altPhone && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.altPhone}</p>}
                  </div>
                  <div>
                    <label htmlFor="pt-whatsapp">{t('patientNew.whatsapp')}</label>
                    <input id="pt-whatsapp" type="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder={t('patientNew.whatsappPlaceholder')} aria-invalid={!!errors.whatsapp} style={errors.whatsapp ? { borderColor: 'var(--color-danger)' } : {}} />
                    {errors.whatsapp && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.whatsapp}</p>}
                  </div>
                  {/* The patient's OWN address, used for things sent to them —
                      the intake-form request first. Optional: most patients
                      here are reachable by phone only, so the send dialog has
                      to handle its absence rather than assume it. */}
                  <div>
                    <label htmlFor="pt-email">{t('hospitals.fieldEmail')}</label>
                    <input id="pt-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} aria-invalid={!!errors.email} style={errors.email ? { borderColor: 'var(--color-danger)' } : {}} />
                    {errors.email && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.email}</p>}
                  </div>
                </div>

                {/* Geocode Identification */}
                <div className="registration-subsection">
                  <h4>{t('patientNew.geographicIdentifier')}</h4>
                  <p>
                    {t('patientNew.geocodeDescription')}
                  </p>
                  <div className="registration-field-grid registration-field-grid--three">
                    <div>
                      <label htmlFor="pt-bomaCode">{t('patientNew.bomaCode')}</label>
                      <input id="pt-bomaCode" type="text" value={form.bomaCode} onChange={e => update('bomaCode', e.target.value.toUpperCase().slice(0, 4))} placeholder={t('patientNew.bomaCodePlaceholder')} maxLength={4} />
                    </div>
                    <div>
                      <label htmlFor="pt-householdNumber">{t('patientNew.householdNumber')}</label>
                      <input id="pt-householdNumber" type="number" value={form.householdNumber} onChange={e => update('householdNumber', e.target.value)} placeholder={t('patientNew.householdNumberPlaceholder')} />
                    </div>
                    <div>
                      <label htmlFor="pt-geocodeId">{t('patientNew.geocodeId')}</label>
                      <input id="pt-geocodeId" type="text" readOnly value={geocodeId || '—'} className="font-mono" aria-readonly="true" style={{ background: 'var(--overlay-subtle)' }} />
                    </div>
                  </div>
                  <div className="registration-field-grid registration-field-grid--three mt-3">
                    <div>
                      <label htmlFor="pt-nationalId">{t('patientNew.nationalId')}</label>
                      <input id="pt-nationalId" type="text" value={form.nationalId} onChange={e => update('nationalId', e.target.value)} placeholder={t('patientNew.nationalIdPlaceholder')} aria-invalid={!!errors.nationalId} style={errors.nationalId ? { borderColor: 'var(--color-danger)' } : {}} />
                      {errors.nationalId && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.nationalId}</p>}
                    </div>
                  </div>
                </div>

                <div className="registration-subsection">
                  <h4>{t('patientNew.address')}</h4>
                  <div className="registration-field-grid registration-field-grid--two">
                    <div>
                      <label htmlFor="pt-state">{t('patientNew.state')}</label>
                      <Select id="pt-state" value={form.state} onChange={e => { update('state', e.target.value); update('county', ''); }} aria-required="true" aria-invalid={!!errors.state} style={errors.state ? { borderColor: 'var(--color-danger)' } : {}}>
                        <option value="">{t('patientNew.selectState')}</option>
                        {states.map(s => <option key={s} value={s}>{s}</option>)}
                      </Select>
                      {errors.state && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.state}</p>}
                    </div>
                    <div>
                      <label htmlFor="pt-county">{t('patientNew.county')}</label>
                      <Select id="pt-county" value={form.county} onChange={e => update('county', e.target.value)} disabled={!form.state} aria-required="true">
                        <option value="">{t('patientNew.selectCounty')}</option>
                        {counties.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="pt-payam">{t('patientNew.payam')}</label>
                      {/* No placeholder: "Enter payam" under a label reading
                          "Payam" is a line of text that carries nothing. */}
                      <input id="pt-payam" type="text" value={form.payam} onChange={e => update('payam', e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="pt-boma">{t('patientNew.boma')}</label>
                      <input id="pt-boma" type="text" value={form.boma} onChange={e => update('boma', e.target.value)} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="pt-address">{t('patientNew.residentialAddress')}</label>
                    <textarea id="pt-address" value={form.address} onChange={e => update('address', e.target.value)} rows={2} placeholder={t('patientNew.residentialAddressPlaceholder')} />
                  </div>
                </div>
                </div>
              </section>
            )}

            {/* Step 2: Next of Kin (multiple contacts supported) */}
            {(
              <section className="registration-section omrs-reg-section" id="reg-nextofkin">
                <header className="omrs-reg-sectionhead">
                  <h2>3. {steps[2]}</h2>
                  <p>{t('patientNew.requiredFieldsNote')}</p>
                </header>
                <div className="omrs-reg-fields">
                <p className="registration-section-note">
                  {t('patientNew.nokSectionNote')}
                </p>

                {/* Primary NOK */}
                <div className="registration-contact-card">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{t('patientNew.primaryBadge')}</span>
                  </div>
                  <div className="registration-field-grid registration-field-grid--two">
                    <div>
                      {/* No ` *` appended here — these three strings already
                          end in one, and the pair rendered as "Full Name * *". */}
                      <label>{t('patientNew.fullName')}</label>
                      <input type="text" value={form.nokName} onChange={e => update('nokName', e.target.value)} placeholder={t('patientNew.nokNamePlaceholder')} aria-invalid={!!errors.nokName} style={errors.nokName ? { borderColor: 'var(--color-danger)' } : {}} />
                      {errors.nokName && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.nokName}</p>}
                    </div>
                    <div>
                      <label>{t('patientNew.relationship')}</label>
                      <Select value={form.nokRelationship} onChange={e => update('nokRelationship', e.target.value)} aria-invalid={!!errors.nokRelationship} style={errors.nokRelationship ? { borderColor: 'var(--color-danger)' } : {}}>
                        <option value="">{t('patientNew.selectRelationship')}</option>
                        {relationshipOptions.map(r => (
                          <option key={r.value} value={r.value}>{t(r.labelKey)}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label>{t('patientNew.nokPhone')}</label>
                      <input type="tel" value={form.nokPhone} onChange={e => update('nokPhone', e.target.value)} placeholder={t('patientNew.phonePlaceholder')} aria-invalid={!!errors.nokPhone} style={errors.nokPhone ? { borderColor: 'var(--color-danger)' } : {}} />
                      {errors.nokPhone && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.nokPhone}</p>}
                    </div>
                    <div>
                      <label>{t('patientNew.nokAddress')}</label>
                      <input type="text" value={form.nokAddress} onChange={e => update('nokAddress', e.target.value)} placeholder={t('patientNew.nokAddressPlaceholder')} />
                    </div>
                  </div>
                </div>

                {/* Additional NOK entries */}
                {additionalNok.map((nok, i) => (
                  <div key={i} className="registration-contact-card">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--overlay-light)', color: 'var(--text-muted)' }}>{t('patientNew.contactNumber', { number: i + 2 })}</span>
                      <button type="button" onClick={() => removeNokEntry(i)} aria-label={t('patientNew.removeContact')} title={t('patientNew.removeContact')} className="p-1.5 rounded-lg transition-colors hover:bg-red-50" style={{ color: 'var(--color-danger)' }}><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="registration-field-grid registration-field-grid--two">
                      <div>
                        <label>{t('patientNew.optionalFullName')}</label>
                        <input type="text" value={nok.name} onChange={e => updateNokEntry(i, { name: e.target.value })} placeholder={t('patientNew.fullNamePlaceholder')} />
                      </div>
                      <div>
                        <label>{t('patientNew.relationshipOptional')}</label>
                        <Select value={nok.relationship} onChange={e => updateNokEntry(i, { relationship: e.target.value })}>
                          <option value="">{t('patientNew.selectRelationship')}</option>
                          {relationshipOptions.map(r => (
                            <option key={r.value} value={r.value}>{t(r.labelKey)}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label>{t('patientNew.phoneOptionalLabel')}</label>
                        <input type="tel" value={nok.phone} onChange={e => updateNokEntry(i, { phone: e.target.value })} placeholder={t('patientNew.phoneNumberPlaceholder')} aria-invalid={!!errors[`additionalNok.${i}.phone`]} style={errors[`additionalNok.${i}.phone`] ? { borderColor: 'var(--color-danger)' } : {}} />
                        {errors[`additionalNok.${i}.phone`] && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors[`additionalNok.${i}.phone`]}</p>}
                      </div>
                      <div>
                        <label>{t('patientNew.addressLocation')}</label>
                        <input type="text" value={nok.address} onChange={e => updateNokEntry(i, { address: e.target.value })} placeholder={t('patientNew.addressLocationPlaceholder')} />
                      </div>
                    </div>
                  </div>
                ))}

                {additionalNok.length < 3 && (
                  <button type="button" onClick={addNokEntry} className="btn btn-secondary btn-sm">
                    + {t('patientNew.addAnotherContact')}
                  </button>
                )}
                </div>
              </section>
            )}

            {/* Step 3: Biometrics — patient photo and fingerprint enrollment */}
            {(
              <section className="registration-section omrs-reg-section" id="reg-biometrics">
                <header className="omrs-reg-sectionhead">
                  <h2>4. {steps[3]}</h2>
                  <p>{t('patientNew.requiredFieldsNote')}</p>
                </header>
                <div className="omrs-reg-fields">
                <p className="registration-section-note">
                  {t('patientNew.biometricsNote')}
                </p>

                {/* Patient photo capture */}
                <div className="registration-inline-panel registration-inline-panel--media">
                  <div className="registration-panel-heading">
                    <h4>{t('patientNew.patientPhotoHeading')}</h4>
                    <span>{t('patientNew.optionalLabel')}</span>
                  </div>
                  <div className="registration-media-row">
                    <div className="flex-shrink-0" style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', border: '2px dashed var(--border-light)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {patientPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={patientPhotoUrl} alt={t('patientNew.photoAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-muted)', opacity: 0.4 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => setShowPhotoModal(true)} className="btn btn-secondary btn-sm flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" />
                        {patientPhotoUrl ? t('patientNew.retakePhoto') : t('patientNew.takePhoto')}
                      </button>
                      {patientPhotoUrl && (
                        <button type="button" onClick={() => setPatientPhotoUrl(null)} className="btn btn-sm text-xs" style={{ color: 'var(--text-muted)', background: 'transparent' }}>
                          {t('action.remove')}
                        </button>
                      )}
                    </div>
                    <p>
                      {t('patientNew.photoHelp')}
                    </p>
                  </div>
                </div>

                <FingerprintCapture value={fingerprints} onChange={setFingerprints} />
                </div>
              </section>
            )}

            {/* Step 4: Payment Coverage */}
            {(
              <section className="registration-section omrs-reg-section" id="reg-coverage">
                <header className="omrs-reg-sectionhead">
                  <h2>5. {steps[4]}</h2>
                  <p>{t('patientNew.requiredFieldsNote')}</p>
                </header>
                <div className="omrs-reg-fields">
                <p className="registration-section-note">
                    {t('patientNew.coverageNote')}
                </p>

                <div>
                  <label>{t('patientNew.coverageTypeLabel')}</label>
                  <div className="registration-option-grid">
                    {([
                      { value: 'out-of-pocket', labelKey: 'patientNew.coverageOutOfPocket', descKey: 'patientNew.coverageOutOfPocketDesc' },
                      { value: 'program', labelKey: 'patientNew.coverageProgram', descKey: 'patientNew.coverageProgramDesc' },
                      { value: 'exemption', labelKey: 'patientNew.coverageExemption', descKey: 'patientNew.coverageExemptionDesc' },
                      { value: 'ngo', labelKey: 'patientNew.coverageNgo', descKey: 'patientNew.coverageNgoDesc' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateCoverageType(opt.value)}
                        className="registration-option-button"
                        style={{
                          border: `2px solid ${form.payorCoverageType === opt.value ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                          background: form.payorCoverageType === opt.value ? 'var(--accent-light)' : 'var(--overlay-subtle)',
                        }}
                      >
                        <span className="text-sm font-semibold" style={{ color: form.payorCoverageType === opt.value ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{t(opt.labelKey)}</span>
                        <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t(opt.descKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.payorCoverageType === 'program' && (
                  <div>
                    <label>{t('patientNew.programName')}</label>
                    <input type="text" value={form.payorProgram} onChange={e => update('payorProgram', e.target.value)} placeholder={t('patientNew.programNamePlaceholder')} />
                  </div>
                )}
                {form.payorCoverageType === 'ngo' && (
                  <div>
                    <label>{t('patientNew.ngoName')}</label>
                    <input type="text" value={form.payorNgo} onChange={e => update('payorNgo', e.target.value)} placeholder={t('patientNew.ngoNamePlaceholder')} />
                  </div>
                )}
                {form.payorCoverageType === 'exemption' && (
                  <div>
                    <label>{t('patientNew.exemptionReasonLabel')}</label>
                    <Select value={form.payorExemptionReason} onChange={e => updateExemptionReason(e.target.value)}>
                      <option value="">{t('patientNew.selectReason')}</option>
                      <option value="Child under 5">{t('patientNew.exemptionChildUnder5')}</option>
                      <option value="Pregnant woman">{t('patientNew.exemptionPregnantWoman')}</option>
                      <option value="Indigent / unable to pay">{t('patientNew.exemptionIndigent')}</option>
                      <option value="Emergency care">{t('patientNew.exemptionEmergency')}</option>
                      <option value="Other">{t('patientNew.exemptionOther')}</option>
                    </Select>
                    {form.payorExemptionReason === 'Other' && (
                      <input type="text" className="mt-2" value={form.payorExemptionOther} onChange={e => update('payorExemptionOther', e.target.value)} placeholder={t('patientNew.specifyReason')} />
                    )}
                  </div>
                )}

                <div className="registration-info-note">
                  <p>
                    {t('patientNew.medicalHistoryDeferredNote')}
                  </p>
                </div>
                </div>
              </section>
            )}

            </>)}

            {/* Step 5: Review — a separate page, not a section of the form.
                Reached from the rail once every required field is answered. */}
            {reviewMode && (
              <RegistrationReview
                title={steps[REVIEW_SECTION]}
                eyebrow={t('patientNew.finalCheck')}
                heading={[form.firstName, form.middleName, form.surname].filter(Boolean).join(' ') || t('patientNew.reviewHeading')}
                photoUrl={patientPhotoUrl}
                photoAlt={t('patientNew.photoAlt')}
                groups={reviewGroups}
                editLabel={t('action.edit')}
                onEdit={goToSection}
              />
            )}

            </div>
          </div>
        </div>
      </main>

      {showPhotoModal && (
        <PhotoCaptureModal
          onCapture={setPatientPhotoUrl}
          onClose={() => setShowPhotoModal(false)}
        />
      )}
    </>
  );
}

export default PatientRegistrationForm;
