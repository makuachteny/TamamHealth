/**
 * Clinical-flow spec layer — authoritative, document-faithful encoding of
 * "EHR Clinical Flow — Architecture Document (v1)".
 *
 * This barrel exposes the workflow state machines, role/capability model,
 * payment model, and patient-identity scheme that the rest of the application
 * must enforce against so the system is RESTRICTED to the documented workflows.
 *
 * See docs/CLINICAL-FLOW-IMPLEMENTATION.md for the section-by-section mapping
 * and the phased plan to wire these into the UI/API layers.
 */

export * from './encounter-journey';
export * from './roles';
export * from './order-lifecycles';
export * from './bhw-workflow';
export * from './payment-model';
export * from './patient-identity';
export * from './capabilities';
export * from './encounter-types';
export * from './encounter-engine';
