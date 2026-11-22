import { sql } from './db';
import type { SchoolScope } from './session';
import type { Change } from './action-utils';

type Db = typeof sql;
export type AuditAction = 'create' | 'update' | 'delete' | 'save';

// Records who did what in the school. Pass the transaction (`tx`) so the entry commits with the change.
export async function audit(
  scope: SchoolScope, action: AuditAction, entity: string, entityId: string | null,
  description: string, changes: Change[] | null = null, db: Db = sql,
) {
  await db`
    INSERT INTO audit_log (school_id, user_id, user_name, user_role, action, entity, entity_id, description, changes)
    VALUES (${scope.schoolId}, ${scope.userId}, ${scope.name}, ${scope.role}, ${action}, ${entity},
            ${entityId}::uuid, ${description}, ${changes && changes.length ? db.json(changes) : null})`;
}
