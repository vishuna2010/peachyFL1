// Using .global.js naming convention for Nuxt 3 global middleware
// This middleware will run for every route. We'll add path checks inside.

import { useAuth } from '~/composables/useAuth'; // Adjust path if your composables are elsewhere

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Only apply this middleware to routes starting with /admin
  if (!to.path.startsWith('/admin')) {
    return;
  }

  const { authToken, authUser, fetchUser } = useAuth();
  const router = useRouter(); // Available globally in Nuxt 3 middleware

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
    console.log(`Admin Auth: User role is "${authUser.value?.role}", not admin. Redirecting to home.`);
    // User is authenticated but not an admin.
    // Redirect to home page or a specific 'unauthorized' page.
    // Avoid redirecting to login if they are already logged in.
    return navigateTo('/'); // Or an '/unauthorized' page
  }

  console.log('Admin Auth: User is admin, access granted to', to.path);
  // If all checks pass, allow navigation
});
