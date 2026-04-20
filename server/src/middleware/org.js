import { supabase } from '../config/supabase.js';
import { HttpError, asyncHandler } from '../utils/async.js';

const ROLE_RANK = { owner: 4, admin: 3, manager: 2, agent: 1 };

export function roleAtLeast(role, minRole) {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[minRole] ?? 0);
}

export function requireOrgRole(minRole, orgIdParam = 'id') {
  return asyncHandler(async (req, _res, next) => {
    const orgId = req.params[orgIdParam];
    if (!orgId) throw new HttpError(400, 'Missing org id');
    if (!req.user?.id) throw new HttpError(401, 'Authentication required');

    const { data: membership, error } = await supabase
      .from('org_members')
      .select('org_id, user_id, role, accepted_at')
      .eq('org_id', orgId)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) throw error;

    if (!membership || !membership.accepted_at) {
      throw new HttpError(403, 'Not a member of this organization');
    }

    if (!roleAtLeast(membership.role, minRole)) {
      throw new HttpError(403, `Requires role ${minRole} or higher`);
    }

    req.orgMembership = { orgId, role: membership.role };
    next();
  });
}
