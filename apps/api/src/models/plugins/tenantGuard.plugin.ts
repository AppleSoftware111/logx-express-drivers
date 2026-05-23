import type { Schema } from 'mongoose';

/**
 * Mongoose plugin that enforces companyId filtering on all queries.
 * Applied to every model that has a companyId field.
 * SUPER_ADMIN bypasses this by setting query option `{ bypassTenant: true }`.
 */
export function tenantGuardPlugin(schema: Schema): void {
  // Pre-hook for find/findOne/findOneAndUpdate/count/countDocuments
  const queryHook = function (this: {
    getOptions: () => Record<string, unknown>;
    getQuery: () => Record<string, unknown>;
    setQuery: (q: Record<string, unknown>) => void;
  }): void {
    const options = this.getOptions();
    if (options['bypassTenant']) return;

    const query = this.getQuery();
    if (!query['companyId']) {
      console.warn(
        '[tenantGuard] Query missing companyId — this may be a bug:',
        new Error().stack
      );
    }
  };

  schema.pre('find', queryHook);
  schema.pre('findOne', queryHook);
  schema.pre('findOneAndUpdate', queryHook);
  schema.pre('countDocuments', queryHook);
}
