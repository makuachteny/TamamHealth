/**
 * FHIR R4: GET /fhir/metadata
 * CapabilityStatement — declares which FHIR resources + operations this
 * server supports. External clients query this first to discover the API.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const now = new Date().toISOString();
  return NextResponse.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: now,
    publisher: 'TamamHealth',
    kind: 'instance',
    software: { name: 'TamamHealth Platform', version: '1.0.0' },
    implementation: {
      description: 'TamamHealth facility FHIR R4 read surface',
      url: process.env.NEXT_PUBLIC_APP_URL || '',
    },
    fhirVersion: '4.0.1',
    format: ['application/fhir+json', 'json'],
    rest: [{
      mode: 'server',
      security: {
        cors: false,
        service: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
            code: 'Certificates',
            display: 'TLS client + TamamHealth JWT cookie',
          }],
        }],
      },
      resource: [
        {
          type: 'Patient',
          interaction: [{ code: 'read' }],
          searchParam: [],
        },
        {
          type: 'Observation',
          interaction: [{ code: 'search-type' }],
          searchParam: [
            { name: 'patient', type: 'reference' },
            { name: 'subject', type: 'reference' },
          ],
        },
        {
          type: 'Encounter',
          interaction: [{ code: 'search-type' }],
          searchParam: [
            { name: 'patient', type: 'reference' },
            { name: 'subject', type: 'reference' },
          ],
        },
        {
          type: 'MedicationRequest',
          interaction: [{ code: 'search-type' }],
          searchParam: [
            { name: 'patient', type: 'reference' },
            { name: 'subject', type: 'reference' },
          ],
        },
      ],
    }],
  }, { headers: { 'Content-Type': 'application/fhir+json' } });
}
