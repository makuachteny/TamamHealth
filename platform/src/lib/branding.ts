import type { OrganizationDoc } from './db-types';

export interface OrgBranding {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export const DEFAULT_BRANDING: OrgBranding = {
  name: 'TamamHealth',
  // Tamam Healthcare System brand greens (style guide, June 2026).
  primaryColor: '#3b82f6',
  secondaryColor: '#1e3a8a',
  accentColor: '#3b82f6',
};

export function getOrgBranding(org?: OrganizationDoc | null): OrgBranding {
  if (!org) return DEFAULT_BRANDING;
  return {
    name: org.name,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor || DEFAULT_BRANDING.primaryColor,
    secondaryColor: org.secondaryColor || DEFAULT_BRANDING.secondaryColor,
    accentColor: org.accentColor || DEFAULT_BRANDING.accentColor,
  };
}

export function brandingToCSSVars(branding: OrgBranding): Record<string, string> {
  return {
    '--org-primary': branding.primaryColor,
    '--org-secondary': branding.secondaryColor,
    '--org-accent': branding.accentColor,
    // Override the accent system with org branding
    '--accent-primary': branding.primaryColor,
    '--accent-hover': branding.secondaryColor,
    '--accent-light': `${branding.primaryColor}12`,
    '--accent-border': `${branding.primaryColor}30`,
    '--nav-active-bg': branding.primaryColor,
  };
}
