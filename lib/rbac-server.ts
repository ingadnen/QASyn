/**
 * Server-side RBAC guards. Kept apart from `rbac.ts` so client components can
 * import the permission matrix without pulling Next.js server APIs.
 */
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { jsonError } from "./http";
import { can, type Permission } from "./rbac";
import { guardApi, requireOrgContext, type OrgContext } from "./tenant";

/** Server Components: redirects to the overview with a denial marker. */
export async function requirePermission(permission: Permission): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  if (!can(ctx.user.role, permission)) {
    redirect(`/dashboard/overview?denied=${permission}`);
  }
  return ctx;
}

type Guard = { ok: true; ctx: OrgContext } | { ok: false; response: NextResponse };

/** Route Handlers: 403 when the role lacks the permission. */
export async function guardPermission(permission: Permission, options: { write?: boolean } = {}): Promise<Guard> {
  const guard = await guardApi(options);
  if (!guard.ok) return guard;
  if (!can(guard.ctx.user.role, permission)) {
    return {
      ok: false,
      response: jsonError(`Your role (${guard.ctx.user.role}) does not allow this action.`, 403),
    };
  }
  return guard;
}

/** Route Handlers: allows the action when ANY of the permissions is granted. */
export async function guardAnyPermission(permissions: Permission[], options: { write?: boolean } = {}): Promise<Guard> {
  const guard = await guardApi(options);
  if (!guard.ok) return guard;
  if (!permissions.some((permission) => can(guard.ctx.user.role, permission))) {
    return {
      ok: false,
      response: jsonError(`Your role (${guard.ctx.user.role}) does not allow this action.`, 403),
    };
  }
  return guard;
}
