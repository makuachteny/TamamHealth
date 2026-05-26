/**
 * API: GET /api/country/metadata?country=SS
 *
 * Country-node metadata endpoint. In a federated deployment this lives on
 * the country node; facility nodes fetch and cache it to translate local
 * codes into the country's canonical vocabulary before shipping data to
 * DHIS2 or the regional layer.
 *
 * This is a stub — it returns a country-profile document assembled from
 * static configuration. A real deployment will back it with
 * organizationsDB() + platformConfigDB() and/or a proper reference-data
 * management pipeline.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logApiError, serverError } from '@/lib/api-auth';

interface CountryMetadata {
  countryId: string;
  name: string;
  locale: string;
  currency: string;
  timezone: string;
  dhis2: {
    baseUrl?: string;
    rootOrgUnit?: string;
    periodType: string;
  };
  terminologies: string[];
  facilityLevels: Array<{ code: string; label: string; order: number }>;
  referralNetwork: Array<{ from: string; to: string[] }>;
  states: string[];
  generatedAt: string;
}

const COUNTRY_CATALOG: Record<string, CountryMetadata> = {
  SS: {
    countryId: 'SS',
    name: 'South Sudan',
    locale: 'en-SS',
    currency: 'SSP',
    timezone: 'Africa/Juba',
    dhis2: {
      baseUrl: 'https://dhis2.gov.ss/api',
      rootOrgUnit: 'SS',
      periodType: 'Monthly',
    },
    terminologies: ['ICD-11', 'LOINC', 'RxNorm'],
    facilityLevels: [
      { code: 'boma',     label: 'Boma PHCU',         order: 1 },
      { code: 'payam',    label: 'Payam PHCC',        order: 2 },
      { code: 'county',   label: 'County Hospital',   order: 3 },
      { code: 'state',    label: 'State Hospital',    order: 4 },
      { code: 'national', label: 'Teaching Hospital', order: 5 },
    ],
    referralNetwork: [
      { from: 'boma',   to: ['payam', 'county', 'state', 'national'] },
      { from: 'payam',  to: ['county', 'state', 'national'] },
      { from: 'county', to: ['state', 'national'] },
      { from: 'state',  to: ['national'] },
    ],
    states: [
      'Central Equatoria', 'Eastern Equatoria', 'Western Equatoria',
      'Jonglei', 'Unity', 'Upper Nile', 'Lakes', 'Warrap',
      'Northern Bahr el Ghazal', 'Western Bahr el Ghazal',
    ],
    generatedAt: '',
  },
  KE: {
    countryId: 'KE',
    name: 'Kenya',
    locale: 'en-KE',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    dhis2: {
      baseUrl: 'https://hiskenya.org/api',
      rootOrgUnit: 'KE',
      periodType: 'Monthly',
    },
    terminologies: ['ICD-11', 'LOINC'],
    facilityLevels: [
      { code: 'level1', label: 'Community',       order: 1 },
      { code: 'level2', label: 'Dispensary',      order: 2 },
      { code: 'level3', label: 'Health Centre',   order: 3 },
      { code: 'level4', label: 'Sub-County',      order: 4 },
      { code: 'level5', label: 'County Referral', order: 5 },
      { code: 'level6', label: 'National',        order: 6 },
    ],
    referralNetwork: [],
    states: [],
    generatedAt: '',
  },
  UG: {
    countryId: 'UG',
    name: 'Uganda',
    locale: 'en-UG',
    currency: 'UGX',
    timezone: 'Africa/Kampala',
    dhis2: { baseUrl: 'https://hmis2.health.go.ug/api', rootOrgUnit: 'UG', periodType: 'Monthly' },
    terminologies: ['ICD-11'],
    facilityLevels: [
      { code: 'hciv',  label: 'Health Centre IV',   order: 4 },
      { code: 'hciii', label: 'Health Centre III',  order: 3 },
      { code: 'hcii',  label: 'Health Centre II',   order: 2 },
      { code: 'hci',   label: 'Village Health Team', order: 1 },
      { code: 'general-hospital', label: 'General Hospital', order: 5 },
      { code: 'regional-referral', label: 'Regional Referral', order: 6 },
    ],
    referralNetwork: [],
    states: [],
    generatedAt: '',
  },
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const country = (url.searchParams.get('country') || 'SS').toUpperCase();
    const meta = COUNTRY_CATALOG[country];
    if (!meta) {
      return NextResponse.json(
        { error: `Unknown country ${country}. Supported: ${Object.keys(COUNTRY_CATALOG).join(', ')}` },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ...meta,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logApiError('[API /country/metadata GET]', err);
    return serverError();
  }
}
