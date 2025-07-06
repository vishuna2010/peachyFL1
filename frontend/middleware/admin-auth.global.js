import { useAuth } from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { authToken, authUser, fetchUser, isAuthInitialized } = useAuth();
  const path = to.path;

  // Only log for admin paths or when there are issues
  const isAdminPath = path.startsWith('/admin');

  // On client-side, if auth is not yet initialized, do nothing and allow rendering.
  if (process.client && !isAuthInitialized.value) {
    if (isAdminPath) {
      console.log(`[AdminAuth] Path: ${path}. Client-side, auth not initialized. Waiting...`);
    }
    return;
  }

  // The rest of the logic applies only to /admin routes
  if (!isAdminPath) {
    return;
  }

  // Only log in development mode
  if (process.dev) {
    console.log(`[AdminAuth] Path: ${path}. Checking admin access...`);
  }

  if (!authToken.value) {
    console.log(`[AdminAuth] Path: ${path}. No auth token found. Redirecting to login.`);
    return navigateTo('/login?redirect=' + path);
  }

  // If token exists but user details (especially role) are missing, fetch them.
  if (!authUser.value || authUser.value.role === undefined) {
    console.log(`[AdminAuth] Path: ${path}. Fetching user details...`);
    await fetchUser();
  }

  // Final check: if still no user or role is not admin, redirect.
  const finalAuthUser = authUser.value;
  const finalUserRole = finalAuthUser?.role;

  if (!finalAuthUser) {
    console.log(`[AdminAuth] Path: ${path}. No user found. Redirecting to login.`);
    return navigateTo('/login?redirect=' + path);
  }

  const allowedAdminRoles = ['admin', 'super_admin'];
  if (!finalUserRole || !allowedAdminRoles.includes(finalUserRole.toLowerCase())) {
    console.log(`[AdminAuth] Path: ${path}. User role "${finalUserRole}" not authorized. Redirecting to homepage.`);
    return navigateTo('/');
  }

  // Only log in development mode
  if (process.dev) {
    console.log(`[AdminAuth] Path: ${path}. Access granted for role "${finalUserRole}".`);
  }
});
