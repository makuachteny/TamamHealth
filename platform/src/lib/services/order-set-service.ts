/**
 * Order sets / clinical protocols service.
 *
 * Order sets are reusable bundles of orders (labs + medications + a
 * treatment-plan note) keyed to a presenting condition — the in-app encoding
 * of national / WHO standard treatment guidelines. They are reference data
 * with the standard CRUD lifecycle, so this service is built on the generic
 * `createCrudService` factory and adds a couple of read helpers on top.
 */

import { orderSetsDB } from '../db';
import type { OrderSetDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { createCrudService } from './crud-service';
import { findByType } from './db-query';
import { filterByScope } from './data-scope';

const service = createCrudService<OrderSetDoc>({
  db: orderSetsDB,
  type: 'order_set',
  idPrefix: 'oset',
  auditLabel: 'ORDER_SET',
});

export const createOrderSet = service.create;
export const updateOrderSet = service.update;
export const getOrderSet = service.get;
export const removeOrderSet = service.remove;

/** All order sets visible in the given scope (defaults to active only). */
export async function getAllOrderSets(
  scope?: DataScope,
  opts: { includeInactive?: boolean } = {},
): Promise<OrderSetDoc[]> {
  const docs = await findByType<OrderSetDoc>(orderSetsDB(), 'order_set');
  const scoped = scope ? filterByScope(docs, scope) : docs;
  const visible = opts.includeInactive ? scoped : scoped.filter(o => o.isActive !== false);
  return visible.sort((a, b) =>
    (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''),
  );
}
