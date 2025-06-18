import { useAuth } from '~/composables/useAuth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { authToken, authUser, fetchUser, isAuthInitialized } = useAuth();

  // Added detailed diagnostic logs
  console.log(`Admin Auth RUNNING for path: ${to.path}`);
  console.log(`  isAuthInitialized: ${isAuthInitialized.value}`);
  console.log(`  authToken present: ${!!authToken.value}`);
  console.log(`  authToken value: ${authToken.value}`); // Log the actual token value
  console.log(`  authUser present: ${!!authUser.value}`);
  if (authUser.value) {
    console.log(`  authUser content: ${JSON.stringify(authUser.value)}`); // Log full user object
    console.log(`  authUser.role: ${authUser.value.role}`);
  } else {
    console.log('  authUser content: null');
  }

  if (process.client && !isAuthInitialized.value) {
    console.log(`Admin Auth (path: ${to.path}): Waiting for auth initialization... Middleware returned early.`);
    return;
  }

  if (!to.path.startsWith('/admin')) {
    return;
  }

  console.log(`Admin Auth (path: ${to.path}): Past initialization checks, proceeding with admin route logic.`);

  if (!authToken.value) {
    console.log(`Admin Auth (path: ${to.path}): No token after init. Redirecting to login.`);
    return navigateTo('/login?redirect=' + to.path);
  }

  if (!authUser.value || authUser.value.role === undefined) {
    console.log(`Admin Auth (path: ${to.path}): Token exists, but user details (or role) missing after init. Fetching user...`);
    await fetchUser();
    // Log authUser again after fetchUser
    if(authUser.value) {
        console.log(`Admin Auth (path: ${to.path}): authUser after fetchUser: ${JSON.stringify(authUser.value)}`);
    } else {
        console.log(`Admin Auth (path: ${to.path}): authUser is null after fetchUser.`);
    }
  }

  if (!authUser.value || authUser.value.role !== 'admin') {
    console.log(`Admin Auth (path: ${to.path}): User role is "${authUser.value?.role}" or user is null. Redirecting.`);
    if (!authUser.value) { // This implies fetchUser failed or resulted in logout
      return navigateTo('/login?redirect=' + to.path);
    }
    return navigateTo('/'); // User is known, but not an admin
  }

  console.log(`Admin Auth (path: ${to.path}): User is admin. Access granted.`);
});
