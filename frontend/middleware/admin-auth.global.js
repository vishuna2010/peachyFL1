import { useAuth } from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { authToken, authUser, fetchUser, isAuthInitialized } = useAuth();
  const path = to.path;

  console.log(`[AdminAuth] Path: ${path}. Starting middleware check.`);

  // On client-side, if auth is not yet initialized, do nothing and allow rendering.
  if (process.client && !isAuthInitialized.value) {
    console.log(`[AdminAuth] Path: ${path}. Client-side, auth not initialized (isAuthInitialized: ${isAuthInitialized.value}). Waiting...`);
    return;
  }
  console.log(`[AdminAuth] Path: ${path}. Auth initialized (isAuthInitialized: ${isAuthInitialized.value}, client: ${process.client}).`);

  // The rest of the logic applies only to /admin routes
  if (!path.startsWith('/admin')) {
    console.log(`[AdminAuth] Path: ${path}. Not an admin path. Skipping further checks.`);
    return;
  }
  console.log(`[AdminAuth] Path: ${path}. Is an admin path. Proceeding with checks.`);

  if (!authToken.value) {
    console.log(`[AdminAuth] Path: ${path}. No auth token found. Redirecting to login.`);
    return navigateTo('/login?redirect=' + path);
  }
  console.log(`[AdminAuth] Path: ${path}. Auth token found.`);

  // If token exists but user details (especially role) are missing, fetch them.
  console.log(`[AdminAuth] Path: ${path}. Before fetchUser check: authUser exists: ${!!authUser.value}, authUser role: ${authUser.value?.role}`);
  if (!authUser.value || authUser.value.role === undefined) {
    console.log(`[AdminAuth] Path: ${path}. authUser or authUser.role is missing/undefined. Attempting to fetch user...`);
    await fetchUser();
    console.log(`[AdminAuth] Path: ${path}. After fetchUser: authUser exists: ${!!authUser.value}, authUser role: ${authUser.value?.role}`);
  }

  // Final check: if still no user or role is not admin, redirect.
  const finalAuthUser = authUser.value; // Capture current state for logging
  const finalUserRole = finalAuthUser?.role;

  console.log(`[AdminAuth] Path: ${path}. Final check: authUser: ${JSON.stringify(finalAuthUser)}, role: ${finalUserRole}`);

  if (!finalAuthUser) {
    console.log(`[AdminAuth] Path: ${path}. Final check failed: authUser is null/undefined. Redirecting to login.`);
    return navigateTo('/login?redirect=' + path);
  }

  const allowedAdminRoles = ['admin', 'super_admin']; // Define allowed admin roles
  // Make the check case-insensitive by converting finalUserRole to lowercase
  if (!finalUserRole || !allowedAdminRoles.includes(finalUserRole.toLowerCase())) {
    console.log(`[AdminAuth] Path: ${path}. Final check failed: User role is "${finalUserRole}" (checking against ${allowedAdminRoles.join(', ')} after converting to lowercase). Redirecting to homepage (/).`);
    return navigateTo('/'); // User is known, but not an admin
  }

  console.log(`[AdminAuth] Path: ${path}. User role "${finalUserRole}" (processed as ${finalUserRole?.toLowerCase()}) is authorized. Access granted to admin section.`);
  // Allow navigation by not returning anything explicitly
});
