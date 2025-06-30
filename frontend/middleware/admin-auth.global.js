import { useAuth } from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { authToken, authUser, fetchUser, isAuthInitialized } = useAuth();
  const path = to.path;

  // On client-side, if auth is not yet initialized, do nothing and allow rendering.
  if (process.client && !isAuthInitialized.value) {
    return;
  }

  // The rest of the logic applies only to /admin routes
  if (!path.startsWith('/admin')) {
    return;
  }

  if (!authToken.value) {
    return navigateTo('/login?redirect=' + path);
  }

  // If token exists but user details (especially role) are missing, fetch them.
  if (!authUser.value || authUser.value.role === undefined) {
    await fetchUser();
  }

  // Final check: if still no user or role is not admin, redirect.
  const finalAuthUser = authUser.value;
  const finalUserRole = finalAuthUser?.role;

  if (!finalAuthUser) {
    return navigateTo('/login?redirect=' + path);
  }

  const allowedAdminRoles = ['admin', 'super_admin']; // Define allowed admin roles
  if (!allowedAdminRoles.includes(finalUserRole)) {
    return navigateTo('/'); // User is known, but not an admin
  }

  // Allow navigation by not returning anything explicitly
});
