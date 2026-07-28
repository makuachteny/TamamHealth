/**
 * CouchDB validate_doc_update function source.
 *
 * Stored verbatim inside a `_design` doc; CouchDB evaluates it as JavaScript
 * inside the database process on every write. DON'T change the function body
 * without testing — a syntax error there BLOCKS ALL WRITES to the database.
 *
 * ## This file no longer holds the function
 *
 * It used to contain a hand-written validator that enforced **org tenancy
 * only**: it checked `orgId` and nothing else. That left the offline-first
 * write path unguarded by role — any authenticated user could create or modify
 * any document type by writing to their local PouchDB replica and letting
 * replication carry it upstream, never touching an API route guard (KAN-94).
 *
 * The validator is now GENERATED from the write-permission matrix in
 * `write-permissions.ts`, so the CouchDB layer and the API route guards read
 * from one table and cannot drift. This module re-exports it so existing
 * imports keep working.
 *
 * @see write-permissions.ts — the matrix, the generator, and the reasoning
 * @see scripts/install-validate-doc-updates.mjs — deploys it to CouchDB
 */

export { ORG_SCOPED_VALIDATE_FN, buildValidateDocUpdateFn } from './write-permissions';
