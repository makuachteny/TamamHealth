'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft, ArrowRight, Trash2 } from '@/components/icons/lucide';
import FingerprintCapture, { type CapturedFingerprint } from '@/components/FingerprintCapture';
import { statesAndCounties, states, tribes, languages } from '@/data/mock';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { enrollFingerprint } from '@/lib/services/fingerprint-service';
import { isValidPhone, isValidNationalId, normalizePhone, normalizeNationalId } from '@/lib/field-formats';

export default function NewPatientPage() {
  const { t } = useTranslation();
  const steps = [t('patientNew.stepDemographics'), t('patientNew.stepContactLocation'), t('patientNew.stepNextOfKin'), 'Payment Coverage', t('patientNew.stepReview')];
  const router = useRouter();
  const { create: createPatient } = usePatients();
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    firstName: '', middleName: '', surname: '', maidenName: '',
    dateOfBirth: '', estimatedAge: '', gender: '', tribe: '', primaryLanguage: '',
    phone: '', altPhone: '', whatsapp: '',
    state: '', county: '', payam: '', boma: '', bomaCode: '', householdNumber: '', address: '',
    nationalId: '',
    nokName: '', nokRelationship: '', nokPhone: '', nokAddress: '',
    payorCoverageType: 'out-of-pocket' as 'out-of-pocket' | 'program' | 'exemption' | 'ngo',
    payorProgram: '', payorNgo: '', payorExemptionReason: '',
  });

  type AdditionalNok = { name: string; relationship: string; phone: string; address: string };
  const [additionalNok, setAdditionalNok] = useState<AdditionalNok[]>([]);
  const addNokEntry = () => setAdditionalNok(rs => rs.length < 3 ? [...rs, { name: '', relationship: '', phone: '', address: '' }] : rs);
  const updateNokEntry = (i: number, patch: Partial<AdditionalNok>) => setAdditionalNok(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const removeNokEntry = (i: number) => setAdditionalNok(rs => rs.filter((_, j) => j !== i));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Fingerprint templates captured during registration (consent-gated inside
  // the component). Persisted AFTER the patient doc exists, in handleSubmit.
  const [fingerprints, setFingerprints] = useState<CapturedFingerprint[]>([]);
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | null>(null);

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };
  const counties = form.state ? statesAndCounties[form.state] || [] : [];

  const geocodeId = form.bomaCode && form.householdNumber
    ? `BOMA-${form.bomaCode.toUpperCase()}-HH${form.householdNumber}`
    : undefined;

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
      if (!form.primaryLanguage) errs.primaryLanguage = 'Primary language is required';
    } else if (s === 1) {
      if (!form.state) errs.state = t('patientNew.errStateRequired');
      if (form.state && !form.county) errs.county = t('patientNew.errCountyRequired');
      // Phone/altPhone/whatsapp are optional — only flag a non-empty malformed
      // value (isValidPhone returns true for empty).
      if (!isValidPhone(form.phone)) errs.phone = t('validation.errPhone');
      if (!isValidPhone(form.altPhone)) errs.altPhone = t('validation.errPhone');
      if (!isValidPhone(form.whatsapp)) errs.whatsapp = t('validation.errPhone');
      if (!isValidNationalId(form.nationalId)) errs.nationalId = t('validation.errNationalId');
    } else if (s === 2) {
      if (!form.nokName.trim()) errs.nokName = t('patientNew.errNokNameRequired');
      if (!form.nokRelationship) errs.nokRelationship = t('patientNew.errRelationshipRequired');
      if (!form.nokPhone.trim()) errs.nokPhone = t('patientNew.errNokPhoneRequired');
      else if (!isValidPhone(form.nokPhone)) errs.nokPhone = t('validation.errPhone');
    }
    return errs;
  };

  const goNext = () => {
    const stepErrors = validateStep(step);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      showToast(t('patientNew.toastFillRequired'), 'error');
      return;
    }
    setErrors({});
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    // Validate all steps before submitting
    const allErrors = { ...validateStep(0), ...validateStep(1), ...validateStep(2) };
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      showToast(t('patientNew.toastFillRequired'), 'error');
      return;
    }

    setSubmitting(true);
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
            phone: n.phone,
            address: n.address || undefined,
          })),
        } : {}),
        payorInfo: {
          coverageType: form.payorCoverageType,
          ...(form.payorProgram ? { programEnrollment: form.payorProgram } : {}),
          ...(form.payorNgo ? { ngoName: form.payorNgo } : {}),
          ...(form.payorExemptionReason ? { exemptionReason: form.payorExemptionReason } : {}),
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
      showToast(`${t('patientNew.toastRegistered', { firstName: form.firstName, surname: form.surname })}${result?.hospitalNumber ? ` — Hospital No. ${result.hospitalNumber}` : ''}`, 'success');
      router.push('/patients');
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
    }
  };

  return (
    <>
      <main className="page-container page-enter">
          <button onClick={() => router.push('/patients')} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: 'var(--tamamhealth-blue)' }}>
            <ArrowLeft className="w-4 h-4" /> {t('patientNew.backToPatients')}
          </button>

          {/* Step Indicator — stretches across the full width of the form below */}
          <div className="flex items-center gap-0 mb-8 w-full">
            {steps.map((s, i) => (
              <div key={s} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
                <div className="flex flex-col items-center">
                  <div className={`step-dot ${i === step ? 'step-dot-active' : i < step ? 'step-dot-completed' : ''}`}>
                    {i < step ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="text-[10px] mt-1.5 font-medium whitespace-nowrap" style={{ color: i === step ? 'var(--tamamhealth-blue)' : 'var(--text-muted)' }}>{s}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`step-line mx-2 flex-1 ${i < step ? 'step-line-completed' : i === step ? 'step-line-active' : ''}`} style={{ width: 'auto' }} />
                )}
              </div>
            ))}
          </div>

          <div className="card-elevated p-6 sm:p-8 lg:p-10 w-full">
            {/* Step 0: Demographics */}
            {step === 0 && (
              <div className="space-y-5">
                <h3 className="text-base font-semibold mb-4">{t('patientNew.demographicsHeading')}</h3>
                <div className="flex gap-3 items-start">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="pt-gender">{t('patientNew.gender')}</label>
                    <select id="pt-gender" value={form.gender} onChange={e => update('gender', e.target.value)} aria-required="true" aria-invalid={!!errors.gender} style={errors.gender ? { borderColor: 'var(--color-danger)' } : {}}>
                      <option value="">{t('patientNew.selectGender')}</option>
                      <option value="Male">{t('patient.male')}</option>
                      <option value="Female">{t('patient.female')}</option>
                    </select>
                    {errors.gender && <p className="text-[11px] mt-1" style={{ color: 'var(--color-danger)' }}>{errors.gender}</p>}
                  </div>
                  <div>
                    <label htmlFor="pt-tribe">{t('patientNew.tribe')}</label>
                    <select id="pt-tribe" value={form.tribe} onChange={e => update('tribe', e.target.value)}>
                      <option value="">{t('patientNew.selectTribe')}</option>
                      {tribes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pt-language">{t('patientNew.primaryLanguage')} *</label>
                    <select id="pt-language" value={form.primaryLanguage} onChange={e => update('primaryLanguage', e.target.value)} aria-required="true" aria-invalid={!!errors.primaryLanguage} style={errors.primaryLanguage ? { borderColor: 'var(--color-danger)' } : {}}>
                      <option value="">{t('patientNew.selectLanguage')}</option>
                      {languages.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    {errors.primaryLanguage && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.primaryLanguage}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Contact & Location */}
            {step === 1 && (
              <div className="space-y-5">
                <h3 className="text-base font-semibold mb-4">{t('patientNew.contactLocationHeading')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="pt-phone">{t('patientNew.phone')}</label>
                    <input id="pt-phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder={t('patientNew.phonePlaceholder')} aria-required="true" aria-invalid={!!errors.phone} style={errors.phone ? { borderColor: 'var(--color-danger)' } : {}} />
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
                </div>

                {/* Geocode Identification */}
                <div className="border-t pt-4" style={{ borderColor: 'var(--border-light)' }}>
                  <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('patientNew.geographicIdentifier')}</h4>
                  <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
                    {t('patientNew.geocodeDescription')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                    <div>
                      <label htmlFor="pt-nationalId">{t('patientNew.nationalId')}</label>
                      <input id="pt-nationalId" type="text" value={form.nationalId} onChange={e => update('nationalId', e.target.value)} placeholder={t('patientNew.nationalIdPlaceholder')} aria-invalid={!!errors.nationalId} style={errors.nationalId ? { borderColor: 'var(--color-danger)' } : {}} />
                      {errors.nationalId && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.nationalId}</p>}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4" style={{ borderColor: 'var(--border-light)' }}>
                  <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{t('patientNew.address')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pt-state">{t('patientNew.state')}</label>
                      <select id="pt-state" value={form.state} onChange={e => { update('state', e.target.value); update('county', ''); }} aria-required="true" aria-invalid={!!errors.state} style={errors.state ? { borderColor: 'var(--color-danger)' } : {}}>
                        <option value="">{t('patientNew.selectState')}</option>
                        {states.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {errors.state && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.state}</p>}
                    </div>
                    <div>
                      <label htmlFor="pt-county">{t('patientNew.county')}</label>
                      <select id="pt-county" value={form.county} onChange={e => update('county', e.target.value)} disabled={!form.state} aria-required="true">
                        <option value="">{t('patientNew.selectCounty')}</option>
                        {counties.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="pt-payam">{t('patientNew.payam')}</label>
                      <input id="pt-payam" type="text" value={form.payam} onChange={e => update('payam', e.target.value)} placeholder={t('patientNew.payamPlaceholder')} />
                    </div>
                    <div>
                      <label htmlFor="pt-boma">{t('patientNew.boma')}</label>
                      <input id="pt-boma" type="text" value={form.boma} onChange={e => update('boma', e.target.value)} placeholder={t('patientNew.bomaPlaceholder')} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="pt-address">{t('patientNew.residentialAddress')}</label>
                    <textarea id="pt-address" value={form.address} onChange={e => update('address', e.target.value)} rows={2} placeholder={t('patientNew.residentialAddressPlaceholder')} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Next of Kin (multiple contacts supported) */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{t('patientNew.nextOfKinHeading')}</h3>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Primary contact required · up to 4 contacts total</span>
                </div>
                <p className="text-xs -mt-4" style={{ color: 'var(--text-muted)' }}>
                  Multiple contacts improve follow-up. Patients may not have reliable phone access, and multiple family members may be involved in care decisions.
                </p>

                {/* Primary NOK */}
                <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>Primary</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label>{t('patientNew.fullName')} *</label>
                      <input type="text" value={form.nokName} onChange={e => update('nokName', e.target.value)} placeholder={t('patientNew.nokNamePlaceholder')} aria-invalid={!!errors.nokName} style={errors.nokName ? { borderColor: 'var(--color-danger)' } : {}} />
                      {errors.nokName && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{errors.nokName}</p>}
                    </div>
                    <div>
                      <label>{t('patientNew.relationship')} *</label>
                      <select value={form.nokRelationship} onChange={e => update('nokRelationship', e.target.value)} aria-invalid={!!errors.nokRelationship} style={errors.nokRelationship ? { borderColor: 'var(--color-danger)' } : {}}>
                        <option value="">{t('patientNew.selectRelationship')}</option>
                        {['Spouse', 'Parent', 'Child', 'Sibling', 'Uncle', 'Aunt', 'Cousin', 'Friend', 'Other'].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>{t('patientNew.nokPhone')} *</label>
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
                  <div key={i} className="p-4 rounded-xl space-y-4" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--overlay-light)', color: 'var(--text-muted)' }}>Contact {i + 2}</span>
                      <button type="button" onClick={() => removeNokEntry(i)} aria-label="Remove contact" title="Remove contact" className="p-1.5 rounded-lg transition-colors hover:bg-red-50" style={{ color: 'var(--color-danger)' }}><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label>Full Name</label>
                        <input type="text" value={nok.name} onChange={e => updateNokEntry(i, { name: e.target.value })} placeholder="Full name" />
                      </div>
                      <div>
                        <label>Relationship</label>
                        <select value={nok.relationship} onChange={e => updateNokEntry(i, { relationship: e.target.value })}>
                          <option value="">Select relationship</option>
                          {['Spouse', 'Parent', 'Child', 'Sibling', 'Uncle', 'Aunt', 'Cousin', 'Friend', 'Other'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label>Phone</label>
                        <input type="tel" value={nok.phone} onChange={e => updateNokEntry(i, { phone: e.target.value })} placeholder="Phone number" />
                      </div>
                      <div>
                        <label>Address / Location</label>
                        <input type="text" value={nok.address} onChange={e => updateNokEntry(i, { address: e.target.value })} placeholder="Village, boma, or address" />
                      </div>
                    </div>
                  </div>
                ))}

                {additionalNok.length < 3 && (
                  <button type="button" onClick={addNokEntry} className="btn btn-secondary btn-sm">
                    + Add another contact
                  </button>
                )}

                {/* Patient photo capture */}
                <div className="card-elevated p-4">
                  <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Patient Photo <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>(optional)</span></h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0" style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', border: '2px dashed var(--border-light)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {patientPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={patientPhotoUrl} alt="Patient" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-muted)', opacity: 0.4 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="btn btn-secondary btn-sm cursor-pointer">
                        {patientPhotoUrl ? 'Change photo' : 'Upload photo'}
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => {
                              const result = ev.target?.result as string;
                              if (result) setPatientPhotoUrl(result);
                            };
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {patientPhotoUrl && (
                        <button type="button" onClick={() => setPatientPhotoUrl(null)} className="btn btn-sm text-xs" style={{ color: 'var(--text-muted)', background: 'transparent' }}>
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] flex-1" style={{ color: 'var(--text-muted)' }}>
                      Use a clear front-facing photo. JPG, PNG or WebP, max 5 MB.
                    </p>
                  </div>
                </div>

                <FingerprintCapture value={fingerprints} onChange={setFingerprints} />
              </div>
            )}

            {/* Step 3: Payment Coverage */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold mb-1">Payment Coverage</h3>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    Capture how this patient&apos;s care will be covered. This information is used at checkout and billing.
                  </p>
                </div>

                <div>
                  <label>Coverage Type *</label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {([
                      { value: 'out-of-pocket', label: 'Out of Pocket', desc: 'Patient pays directly' },
                      { value: 'program', label: 'Program Enrolled', desc: 'Government or NGO program' },
                      { value: 'exemption', label: 'Exemption', desc: 'Fee waiver or exemption status' },
                      { value: 'ngo', label: 'NGO Covered', desc: 'NGO covers services' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update('payorCoverageType', opt.value)}
                        className="flex flex-col items-start p-4 rounded-xl text-left transition-all"
                        style={{
                          border: `2px solid ${form.payorCoverageType === opt.value ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                          background: form.payorCoverageType === opt.value ? 'var(--accent-light)' : 'var(--overlay-subtle)',
                        }}
                      >
                        <span className="text-sm font-semibold" style={{ color: form.payorCoverageType === opt.value ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{opt.label}</span>
                        <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.payorCoverageType === 'program' && (
                  <div>
                    <label>Program Name</label>
                    <input type="text" value={form.payorProgram} onChange={e => update('payorProgram', e.target.value)} placeholder="e.g. UNICEF Health Program, MoH Free Care" />
                  </div>
                )}
                {form.payorCoverageType === 'ngo' && (
                  <div>
                    <label>NGO Name</label>
                    <input type="text" value={form.payorNgo} onChange={e => update('payorNgo', e.target.value)} placeholder="e.g. MSF, IRC, GOAL" />
                  </div>
                )}
                {form.payorCoverageType === 'exemption' && (
                  <div>
                    <label>Exemption Reason</label>
                    <select value={form.payorExemptionReason} onChange={e => update('payorExemptionReason', e.target.value)}>
                      <option value="">Select reason</option>
                      <option value="Child under 5">Child under 5</option>
                      <option value="Pregnant woman">Pregnant woman</option>
                      <option value="Indigent / unable to pay">Indigent / unable to pay</option>
                      <option value="Emergency care">Emergency care</option>
                      <option value="Other">Other</option>
                    </select>
                    {form.payorExemptionReason === 'Other' && (
                      <input type="text" className="mt-2" value={form.payorExemptionReason === 'Other' ? '' : form.payorExemptionReason} onChange={e => update('payorExemptionReason', e.target.value)} placeholder="Specify reason" />
                    )}
                  </div>
                )}

                <div className="p-4 rounded-lg" style={{ background: 'rgba(33,145,208,0.06)', border: '1px solid rgba(33,145,208,0.15)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Medical history, allergies, and chronic conditions are collected later during triage and clinical consultation — not at registration.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <div style={{ width: 60, height: 60, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-light)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {patientPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={patientPhotoUrl} alt="Patient" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-muted)', opacity: 0.4 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                    )}
                  </div>
                  <h3 className="text-base font-semibold">{t('patientNew.reviewHeading')}</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewDemographics')}</h4>
                    <div className="space-y-1.5">
                      <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewName')}</span> {form.firstName} {form.middleName} {form.surname}</p>
                      <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewDob')}</span> {form.dateOfBirth || t('patientNew.reviewYears', { age: form.estimatedAge })}</p>
                      <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewGender')}</span> {form.gender}</p>
                      <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewTribe')}</span> {form.tribe}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewContactIdentity')}</h4>
                    <div className="space-y-1.5">
                      <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewPhone')}</span> {form.phone}</p>
                      <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewLocation')}</span> {form.state}, {form.county}</p>
                      {geocodeId && <p className="text-sm font-mono"><span style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewGeocodeId')}</span> {geocodeId}</p>}
                      {form.nationalId && <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewNationalId')}</span> {form.nationalId}</p>}
                      <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>{t('patientNew.reviewNok')}</span> {form.nokName} ({form.nokRelationship})</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Payment Coverage</h4>
                    <div className="space-y-1.5">
                      <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>Coverage:</span> {form.payorCoverageType}</p>
                      {form.payorProgram && <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>Program:</span> {form.payorProgram}</p>}
                      {form.payorNgo && <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>NGO:</span> {form.payorNgo}</p>}
                      {form.payorExemptionReason && <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>Exemption:</span> {form.payorExemptionReason}</p>}
                      {additionalNok.length > 0 && (
                        <p className="text-sm"><span style={{ color: 'var(--text-muted)' }}>Additional contacts:</span> {additionalNok.length}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-5 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <button onClick={() => step > 0 ? setStep(step - 1) : router.push('/patients')} className="btn btn-secondary">
                <ArrowLeft className="w-4 h-4" /> {step === 0 ? t('patientNew.cancel') : t('patientNew.previous')}
              </button>
              {step < steps.length - 1 ? (
                <button onClick={goNext} className="btn btn-primary">
                  {t('patientNew.next')} <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="btn btn-success" style={{ opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {t('patientNew.saving')}</> : <><Check className="w-4 h-4" /> {t('patientNew.registerPatient')}</>}
                </button>
              )}
            </div>
          </div>
      </main>
    </>
  );
}
