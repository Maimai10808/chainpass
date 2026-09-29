import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
} from 'better-auth/plugins/admin/access';

export const statements = {
  ...defaultStatements,

  event: [
    'create',
    'read',
    'update',
    'delete',
    'publish',
  ],

  pass: [
    'claim',
    'read',
    'verify',
    'check-in',
    'revoke',
  ],

  merchant: [
    'read',
    'approve',
    'suspend',
  ],
} as const;

export const ac = createAccessControl(statements);

/**
 * Platform administrator.
 *
 * Can manage Better Auth users/sessions and all ChainPass business resources.
 */
export const adminRole = ac.newRole({
  ...adminAc.statements,

  event: [
    'create',
    'read',
    'update',
    'delete',
    'publish',
  ],

  pass: [
    'claim',
    'read',
    'verify',
    'check-in',
    'revoke',
  ],

  merchant: [
    'read',
    'approve',
    'suspend',
  ],
});

/**
 * Merchant / event organizer.
 *
 * Can create and manage events and verify/check-in passes.
 */
export const merchantRole = ac.newRole({
  event: [
    'create',
    'read',
    'update',
    'delete',
    'publish',
  ],

  pass: [
    'read',
    'verify',
    'check-in',
  ],

  merchant: [],
});

/**
 * Normal ChainPass user.
 *
 * Can browse events, claim passes and view their passes.
 */
export const userRole = ac.newRole({
  event: [
    'read',
  ],

  pass: [
    'claim',
    'read',
  ],

  merchant: [],
});

export const roles = {
  admin: adminRole,
  merchant: merchantRole,
  user: userRole,
} as const;

export type ChainPassRole = keyof typeof roles;
