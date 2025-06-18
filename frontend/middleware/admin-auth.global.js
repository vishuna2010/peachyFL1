// Using .global.js naming convention for Nuxt 3 global middleware
// This middleware will run for every route. We'll add path checks inside.

import { useAuth } from '~/composables/useAuth'; // Adjust path if your composables are elsewhere

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { authToken, authUser, fetchUser, isAuthInitialized } = useAuth(); // Ensure isAuthInitialized is pulled
  console.log(`Admin Auth RUNNING for path: ${to.path}`);
  console.log(`  isAuthInitialized: ${isAuthInitialized.value}`);
  console.log(`  authToken present: ${!!authToken.value}`);
  console.log(`  authUser present: ${!!authUser.value}`);
  if (authUser.value) {
    console.log(`  authUser.role: ${authUser.value.role}`);
  }

  // Only apply this middleware to routes starting with /admin
  if (!to.path.startsWith('/admin')) {
    return;
  }

  // const { authToken, authUser, fetchUser } = useAuth(); // This line is now at the top
  const router = useRouter(); // Available globally in Nuxt 3 middleware

  // It might be prudent to wait for initialization if critical,
  // but for now, the logs will show us the state.
  // A simple check: if not initialized and trying to access admin, maybe hold off or special log.
  if (to.path.startsWith('/admin') && process.client && !isAuthInitialized.value) {
    console.log('Admin Auth: Auth not yet initialized by useAuth. State might be incomplete.');
    // Depending on app behavior, might return or wait for a short period.
    // For now, logging is the primary goal.
  }

  if (!authToken.value) {
    console.log('Admin Auth: No token, redirecting to login.');
    return navigateTo('/login?redirect=' + to.path); // Redirect to login, saving intended path
  }

  // If we have a token but no user info, try to fetch it.
  // This is crucial for page reloads or direct navigation to admin pages.
  if (authToken.value && !authUser.value) {
    console.log('Admin Auth: Token exists, user data missing, fetching user...');
    await fetchUser(); // Assumes fetchUser updates authUser in the composable
  }

  // After attempting to fetch user, check role
  if (authUser.value?.role !== 'admin') {
    console.log(`Admin Auth: User role is "${authUser.value?.role}", not admin. Redirecting to login (or home if appropriate).`);
    // User is authenticated but not an admin, or authUser became null after fetchUser failure
    // The original redirect was to /login?redirect=... which implies an auth failure.
    // If authUser exists but role is not admin, redirect to '/' (home).
    // If authUser is null (e.g. fetchUser failed and logged out), then the earlier !authToken.value would catch it on next cycle,
    // or it gets caught here.
    // Forcing redirect to login to match user's reported behavior for this diagnostic.
    return navigateTo('/login?redirect=' + to.path);
  }

  console.log('Admin Auth: User is admin, access granted to', to.path);
  // If all checks pass, allow navigation
});
