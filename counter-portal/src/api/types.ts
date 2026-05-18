// Mirrors the ACTUAL backend /api/auth/login response (E2-01):
//   { token, user: { id, username, email, role, tenantId, status } }
// NOTE: the original E4-01 spec assumed `accessToken` +
// defaultCategoryId / siteAssignments. The live backend returns `token`
// and the leaner user shape below, so the client adapts to reality
// rather than changing the backend (per task constraint).

export type CounterRole = 'SUPER_ADMIN' | 'CUSTOMER_ADMIN' | 'OPERATOR';

export type CounterUser = {
  id: string;
  username: string;
  email: string | null;
  role: CounterRole;
  tenantId: string | null;
  status: string;
};

export type LoginResponse = {
  token: string;
  user: CounterUser;
};
