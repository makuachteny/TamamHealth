import type { OrganizationDoc } from './db-types';
import { BRAND_PRIMARY, BRAND_SECONDARY } from './theme-colors';

export interface OrgBranding {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export const DEFAULT_BRANDING: OrgBranding = {
  name: 'TamamHealth',
  primaryColor: BRAND_PRIMARY,
  secondaryColor: BRAND_SECONDARY,
  accentColor: BRAND_PRIMARY,
};

/* Orgs saved before the dark-navy rebrand stored the old #2191D0 header blue
   as their primary/accent color. These runtime branding vars override
   --accent-primary on the root element, so a stale stored blue would repaint
   the whole accent system (buttons, floating message dock, …) even after the
   CSS tokens moved to navy. Treat the previous default as "unset" so those
   installations pick up the current brand color. */
const LEGACY_DEFAULT_BLUE = '#2191d0';

/* Only a literal hex color may override the accent system. Some stored org
   docs carried junk like 'var(--accent-primary)' — a self-referential CSS
   var that invalidates the whole accent cascade and repaints buttons with
   whatever leaks through (e.g. the hover indigo). Anything non-hex falls
   back to the default brand color. */
function isHexColor(color: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color.trim());
}

function modernizeColor(color?: string): string | undefined {
  if (!color || !isHexColor(color)) return undefined;
  return color.toLowerCase() !== LEGACY_DEFAULT_BLUE ? color : undefined;
}

export function getOrgBranding(org?: OrganizationDoc | null): OrgBranding {
  if (!org) return DEFAULT_BRANDING;
  return {
    name: org.name,
    logoUrl: org.logoUrl,
    primaryColor: modernizeColor(org.primaryColor) || DEFAULT_BRANDING.primaryColor,
    secondaryColor: modernizeColor(org.secondaryColor) || DEFAULT_BRANDING.secondaryColor,
    accentColor: modernizeColor(org.accentColor) || DEFAULT_BRANDING.accentColor,
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
