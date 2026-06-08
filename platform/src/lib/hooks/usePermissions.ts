import { useApp } from '@/lib/context';
import { isRouteAllowed, getRoleConfig } from '@/lib/permissions';
import type { UserRole } from '@/lib/db-types';

export function usePermissions() {
  const { currentUser } = useApp();
  const role = currentUser?.role as UserRole | undefined;

  const isSuperAdmin = role === 'super_admin';
  const isOrgAdmin = role === 'org_admin';
  const isGovernment = role === 'government';
  const isDataEntry = role === 'data_entry_clerk';
  const isHospitalManager = role === 'hospital_manager';
  const isMedicalBiller = role === 'medical_biller';
  const isCashier = role === 'cashier';
  const isMidwife = role === 'midwife';
  const isCountyDirector = role === 'county_health_director';
  // Clinical-flow workflow stations (EHR Clinical Flow doc §4)
  const isClinician = role === 'clinician';
  const isTriageNurse = role === 'triage_nurse';
  const isRoomingNurse = role === 'rooming_nurse';
  const isRegistrationClerk = role === 'central_registration_clerk';
  const isClinicClerk = role === 'clinic_clerk';
  const isRecordsHmis = role === 'records_hmis_officer';
  const isFacilityAdmin = role === 'facility_administrator';

  // Platform & org management
  const canManagePlatform = isSuperAdmin;
  const canManageOrg = isSuperAdmin || isOrgAdmin;
  const canViewCrossOrg = isSuperAdmin;
  const canEditBranding = isSuperAdmin || isOrgAdmin;
  const canManageUsers = isGovernment || isSuperAdmin || isOrgAdmin || isFacilityAdmin;

  // Clinical work — only clinical staff. super_admin is a SaaS platform
  // operator: it keeps clinical *read* (canViewClinical) for support/QA but
  // not clinical *write* (consult/prescribe/order/dispense/results/telehealth).
  const isMedSupt = role === 'medical_superintendent';
  const canEditClinical = role === 'doctor' || role === 'clinical_officer' || isClinician || isMedSupt;
  // Midwives provide clinical maternity care, so they can view clinical records.
  const canViewClinical = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || isMidwife || isClinician || isTriageNurse || isRoomingNurse || isFacilityAdmin || isMedSupt || isSuperAdmin;
  const canConsult = role === 'doctor' || role === 'clinical_officer' || isClinician || isMedSupt;
  const canPrescribe = role === 'doctor' || role === 'clinical_officer' || isClinician || isMedSupt;
  const canOrderLabs = role === 'doctor' || role === 'clinical_officer' || isClinician || isMedSupt;

  // Patient registration — clinical + front desk + BHW + midwife + workflow clerks/nurses
  const canRegisterPatients = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || isMidwife || isClinician || isTriageNurse || isRoomingNurse || isRegistrationClerk || isClinicClerk || role === 'front_desk' || role === 'boma_health_worker' || role === 'community_health_volunteer' || role === 'hrio' || isMedSupt;

  // Specialized roles
  const canDispense = role === 'pharmacist';
  const canEnterLabResults = role === 'lab_tech';
  const canDoTelehealth = role === 'doctor' || isClinician || isMedSupt;

  // Referrals — clinical staff + front desk + supervisors + midwife (obstetric)
  const canManageReferrals = role === 'doctor' || role === 'clinical_officer' || isClinician || isMidwife || isRegistrationClerk || role === 'front_desk' || role === 'payam_supervisor' || isSuperAdmin;

  // Appointments — clinical staff + front desk + workflow clerks can book/manage
  const canBookAppointments = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || isMidwife || isClinician || isRegistrationClerk || isClinicClerk || role === 'front_desk' || isMedSupt || isSuperAdmin;

  // Messages — any clinical/CHW role can send (view is broader via nav config)
  const canSendMessages = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || isMidwife || isClinician || isTriageNurse || isRoomingNurse || isRegistrationClerk || isClinicClerk || isRecordsHmis || isFacilityAdmin || role === 'front_desk' || isCashier || role === 'pharmacist' || role === 'lab_tech' || role === 'boma_health_worker' || role === 'community_health_volunteer' || role === 'payam_supervisor' || isCountyDirector || role === 'hrio' || role === 'nutritionist' || role === 'radiologist' || isMedSupt || isOrgAdmin || isSuperAdmin;

  // Facility assessments — data entry + supervisors + government + hospital manager + county + records/admin
  const canAssessFacility = isDataEntry || role === 'hrio' || isRecordsHmis || isFacilityAdmin || role === 'payam_supervisor' || isMedSupt || isGovernment || isCountyDirector || isHospitalManager || isSuperAdmin;

  // Analytics & intelligence — management + government + county (moved off doctors)
  const canViewEpidemicIntel = isHospitalManager || isMedSupt || isFacilityAdmin || isGovernment || isCountyDirector || isSuperAdmin;
  const canViewMCHAnalytics = role === 'nutritionist' || isHospitalManager || isMedSupt || isFacilityAdmin || isGovernment || isCountyDirector || isSuperAdmin;

  // Reports & export — HRIO, records/HMIS officer, and the county director own DHIS2/HMIS reporting.
  const canExportDHIS2 = isGovernment || isHospitalManager || role === 'hrio' || isRecordsHmis || isCountyDirector || isSuperAdmin;
  const canViewReports = role === 'clinical_officer' || role === 'payam_supervisor' || role === 'hrio' || isRecordsHmis || isFacilityAdmin || isHospitalManager || isMedSupt || isGovernment || isCountyDirector || isOrgAdmin || isSuperAdmin;

  // Billing & collections — biller + dedicated cashier + management + admins.
  // Front desk no longer handles money (separation of duties).
  const canCollectPayments = isMedicalBiller || isCashier || isFacilityAdmin || isMedSupt || isOrgAdmin || isSuperAdmin;
  const canManageBilling = isMedicalBiller || isFacilityAdmin || isHospitalManager || isOrgAdmin || isSuperAdmin;

  // Vital events — clinical staff + midwife + BHW/CHV + records/data entry + workflow nurses/clinician
  const canRecordVitalEvents = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || isMidwife || isClinician || isTriageNurse || isRoomingNurse || isRecordsHmis || role === 'boma_health_worker' || role === 'community_health_volunteer' || role === 'hrio' || isDataEntry || isMedSupt;

  const canAccess = (path: string): boolean => {
    if (!role) return false;
    return isRouteAllowed(role, path);
  };

  const roleConfig = role ? getRoleConfig(role) : null;

  return {
    role,
    roleConfig,
    isSuperAdmin,
    isOrgAdmin,
    isGovernment,
    isDataEntry,
    isHospitalManager,
    isMedicalBiller,
    isCashier,
    isMidwife,
    isCountyDirector,
    canManagePlatform,
    canManageOrg,
    canViewCrossOrg,
    canEditBranding,
    canManageUsers,
    canEditClinical,
    canViewClinical,
    canConsult,
    canPrescribe,
    canOrderLabs,
    canRegisterPatients,
    canDispense,
    canEnterLabResults,
    canDoTelehealth,
    canManageReferrals,
    canBookAppointments,
    canSendMessages,
    canAssessFacility,
    canViewEpidemicIntel,
    canViewMCHAnalytics,
    canExportDHIS2,
    canViewReports,
    canCollectPayments,
    canManageBilling,
    canRecordVitalEvents,
    canAccess,
  };
}
