import { useAuth } from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { authToken, authUser, fetchUser, isAuthInitialized } = useAuth();

  // On client-side, if auth is not yet initialized, do nothing and allow rendering.
  // useAuth will update reactively, and this middleware will run again if needed.
  if (process.client && !isAuthInitialized.value) {
    // console.log(`Admin Auth (path: ${to.path}): Waiting for auth initialization...`); // Optional: keep for debugging if issues persist
    return;
  }

  // The rest of the logic applies only to /admin routes AND after auth is initialized (on client) or immediately (on server)
  if (!to.path.startsWith('/admin')) {
    return;
  }

  // At this point, on client, isAuthInitialized.value is true.
  // On server, localStorage isn't used, so direct checks are fine.

  if (!authToken.value) {
    // console.log(`Admin Auth (path: ${to.path}): No token. Redirecting to login.`);
    return navigateTo('/login?redirect=' + to.path);
  }

  // If token exists but user details (especially role) are missing, fetch them.
  // This is crucial for SSR or if authUser wasn't fully populated from localStorage.
  if (!authUser.value || authUser.value.role === undefined) {
    // console.log(`Admin Auth (path: ${to.path}): Token exists, but user details (or role) missing. Fetching user...`);
    await fetchUser(); // fetchUser now gets role from /api/auth/me
  }

  // Final check: if still no user or role is not admin, redirect.
  if (!authUser.value || authUser.value.role !== 'admin') {
    // console.log(`Admin Auth (path: ${to.path}): User role is "${authUser.value?.role}". Not admin or user is null. Redirecting.`);
    if (!authUser.value) { // If fetchUser failed and resulted in logout (authUser became null)
      return navigateTo('/login?redirect=' + to.path);
    }
    return navigateTo('/'); // User is known, but not an admin
  }

  // console.log(`Admin Auth (path: ${to.path}): User is admin. Access granted.`);
  // Allow navigation by not returning anything explicitly
});
