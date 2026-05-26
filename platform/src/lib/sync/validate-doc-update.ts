/**
 * CouchDB validate_doc_update function source.
 *
 * Stored verbatim inside a _design doc; CouchDB evaluates it as JavaScript
 * inside the database process on every write. The user context is the
 * authenticated CouchDB user (see scripts/setup-couchdb.sh for the per-org
 * user provisioning). DON'T change the function body without testing — a
 * syntax error here BLOCKS ALL WRITES to the database.
 */
export const ORG_SCOPED_VALIDATE_FN = `function (newDoc, oldDoc, userCtx, secObj) {
  // Replication brings in _deleted tombstones; allow them through so deletes propagate.
  if (newDoc._deleted) return;

  // Design docs are admin-only; the CouchDB security object handles that.
  if (newDoc._id && newDoc._id.indexOf('_design/') === 0) return;

  // Admin role bypasses tenant enforcement (server-side service writes use this).
  var roles = (userCtx && userCtx.roles) || [];
  if (roles.indexOf('_admin') !== -1) return;

  // Require orgId on every non-design, non-deleted document.
  if (!newDoc.orgId || typeof newDoc.orgId !== 'string') {
    throw({ forbidden: 'orgId is required on this database' });
  }

  // If the user's CouchDB roles include 'org:<orgId>', enforce it matches.
  // Otherwise (e.g., service account writing on behalf of any org) allow.
  for (var i = 0; i < roles.length; i++) {
    if (roles[i].indexOf('org:') === 0) {
      var allowedOrg = roles[i].substring(4);
      if (newDoc.orgId !== allowedOrg) {
        throw({ forbidden: 'orgId mismatch: doc=' + newDoc.orgId + ' user=' + allowedOrg });
      }
      // On update, the orgId must not change.
      if (oldDoc && oldDoc.orgId && oldDoc.orgId !== newDoc.orgId) {
        throw({ forbidden: 'orgId is immutable' });
      }
      return;
    }
  }
}`;
