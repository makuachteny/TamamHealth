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

  // Platform & org management
  const canManagePlatform = isSuperAdmin;
  const canManageOrg = isSuperAdmin || isOrgAdmin;
  const canViewCrossOrg = isSuperAdmin;
  const canEditBranding = isSuperAdmin || isOrgAdmin;
  const canManageUsers = isGovernment || isSuperAdmin || isOrgAdmin;

  // Clinical work — only clinical staff
  const isMedSupt = role === 'medical_superintendent';
  const canEditClinical = role === 'doctor' || role === 'clinical_officer' || isMedSupt || isSuperAdmin;
  const canViewClinical = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || isMedSupt || isSuperAdmin;
  const canConsult = role === 'doctor' || role === 'clinical_officer' || isMedSupt || isSuperAdmin;
  const canPrescribe = role === 'doctor' || role === 'clinical_officer' || isMedSupt || isSuperAdmin;
  const canOrderLabs = role === 'doctor' || role === 'clinical_officer' || isMedSupt || isSuperAdmin;

  // Patient registration — clinical + front desk + BHW
  const canRegisterPatients = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || role === 'front_desk' || role === 'boma_health_worker' || role === 'community_health_volunteer' || role === 'hrio' || isMedSupt || isSuperAdmin;

  // Specialized roles
  const canDispense = role === 'pharmacist' || isSuperAdmin;
  const canEnterLabResults = role === 'lab_tech' || isSuperAdmin;
  const canDoTelehealth = role === 'doctor' || isMedSupt || isSuperAdmin;

  // Referrals — clinical staff + front desk + supervisors
  const canManageReferrals = role === 'doctor' || role === 'clinical_officer' || role === 'front_desk' || role === 'payam_supervisor' || isSuperAdmin;

  // Appointments — clinical staff + front desk can book/manage; government/org_admin are view-only
  const canBookAppointments = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || role === 'front_desk' || isMedSupt || isSuperAdmin;

  // Messages — any clinical/CHW role can send (view is broader via nav config)
  const canSendMessages = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || role === 'front_desk' || role === 'pharmacist' || role === 'lab_tech' || role === 'boma_health_worker' || role === 'community_health_volunteer' || role === 'payam_supervisor' || role === 'hrio' || role === 'nutritionist' || role === 'radiologist' || isMedSupt || isOrgAdmin || isSuperAdmin;

  // Facility assessments — data entry + supervisors + government
  const canAssessFacility = isDataEntry || role === 'hrio' || role === 'payam_supervisor' || isMedSupt || isGovernment || isSuperAdmin;

  // Analytics & intelligence — doctors + government
  const canViewEpidemicIntel = role === 'doctor' || isMedSupt || isGovernment || isSuperAdmin;
  const canViewMCHAnalytics = role === 'doctor' || role === 'nutritionist' || isMedSupt || isGovernment || isSuperAdmin;

  // Reports & export
  const canExportDHIS2 = isGovernment || isSuperAdmin;
  const canViewReports = role === 'doctor' || role === 'clinical_officer' || role === 'payam_supervisor' || role === 'hrio' || isMedSupt || isGovernment || isOrgAdmin || isSuperAdmin;

  // Vital events — most clinical staff + BHW + data entry
  const canRecordVitalEvents = role === 'doctor' || role === 'clinical_officer' || role === 'nurse' || role === 'boma_health_worker' || role === 'community_health_volunteer' || role === 'hrio' || isDataEntry || isMedSupt || isSuperAdmin;

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
    canRecordVitalEvents,
    canAccess,
  };
}
