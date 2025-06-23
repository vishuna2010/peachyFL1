import { useAuth } from '~/composables/useAuth';
import { usePermissions } from '~/composables/usePermissions';
import { navigateTo, abortNavigation } from '#app';

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip middleware on server-side for initial load if permissions depend on client-side auth resolution,
  // or handle SSR auth state carefully. For now, let's focus on client-side navigation guards post-initial load,
  // or assume auth state (including permissions) is resolved by the time this runs.
  // The useAuth composable should ideally handle initial auth state restoration.

  if (process.server) {
    // During SSR, if auth state isn't definitively known (e.g. relies on client-side token),
    // it's often better to let the page render and then have client-side checks / redirects.
    // Or, ensure useAuth().initAuth() or similar is completed.
    // For now, we'll mostly let SSR pass and rely on client-side enforcement / API protection.
    // However, if a user is definitively known to be unauth on SSR, we can redirect.
    // const { isAuthenticatedSsr } = useAuth(); // Assuming useAuth could provide an SSR-safe auth check
    // if (to.path.startsWith('/admin') && !isAuthenticatedSsr.value && to.path !== '/login') {
    //   console.log('[Middleware SSR] Admin route, user not authenticated on server. Aborting/redirecting.');
    //   return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    // }
    return; // Let SSR proceed, client-side will handle finer details or redirects after hydration.
  }

  const { isAuthenticated, authUser } = useAuth();
  const { fetchUserPermissions, can, userPermissions, isLoadingPermissions } = usePermissions();

  // If navigating to an admin route
  if (to.path.startsWith('/admin')) {
    // If not authenticated, redirect to login
    if (!isAuthenticated.value) {
      if (to.path !== '/login') { // Avoid redirect loop if already on login
        console.log('[Middleware] Admin route, user not authenticated. Redirecting to login.');
        return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
      }
      return; // Already on login page
    }

    // User is authenticated, ensure permissions are loaded or being loaded.
    // This check helps if navigation happens before initial permission fetch completes.
    if (userPermissions.value.length === 0 && !isLoadingPermissions.value && authUser.value?.id) {
        // console.log('[Middleware] Permissions not loaded for authenticated admin user, fetching...');
        await fetchUserPermissions(); // Wait for permissions to be fetched
    }

    // If still loading after attempting fetch, might need to show a loader or abort temporarily.
    // For simplicity, we'll assume fetchUserPermissions resolves. A more complex app might use a loading state.

    // Check for base admin access permission
    if (!can('admin:access_dashboard').value) {
      console.log(`[Middleware] User ${authUser.value?.email} lacks 'admin:access_dashboard' permission for ${to.path}. Redirecting.`);
      // Abort navigation and show an error or redirect to a 'forbidden' page or home
      // For now, redirect to home, but a dedicated /admin/forbidden page would be better.
      // Make sure not to redirect from /admin to /admin if they lack dashboard but have other specific admin rights (complex case).
      // Simplest for now: if no dashboard access, they can't access any /admin page.
      return navigateTo('/'); // Or '/admin/access-denied'
    }

    // Specific page permissions (examples)
    if (to.path.startsWith('/admin/users') && !can('users:view').value) {
      console.log(`[Middleware] User ${authUser.value?.email} lacks 'users:view' for ${to.path}. Redirecting.`);
      return navigateTo('/admin'); // Or '/admin/access-denied'
    }
    if (to.path.startsWith('/admin/products') && !can('products:view').value) {
      console.log(`[Middleware] User ${authUser.value?.email} lacks 'products:view' for ${to.path}. Redirecting.`);
      return navigateTo('/admin');
    }
    if (to.path.startsWith('/admin/roles') && !can('rbac:manage').value) {
      console.log(`[Middleware] User ${authUser.value?.email} lacks 'rbac:manage' for ${to.path}. Redirecting.`);
      return navigateTo('/admin');
    }
    // Add more specific checks for other sections as needed...
    // e.g., /admin/orders requires 'orders:view_all'
    // e.g., /admin/taxes requires 'taxes:manage_classes' or 'taxes:manage_rates'

  } else if (to.path === '/login' && isAuthenticated.value) {
    // If user is authenticated and tries to go to login page, redirect to admin dashboard or home
    // console.log('[Middleware] Authenticated user on login page. Redirecting to /admin.');
    return navigateTo('/admin');
  }

  // Allow navigation if none of the above conditions are met
  return;
});
