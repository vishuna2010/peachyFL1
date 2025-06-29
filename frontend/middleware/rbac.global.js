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
        console.log('[rbac.global.js] Admin route, user not authenticated. Redirecting to login.');
        return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
      }
      return; // Already on login page
    }

    // User is authenticated, ensure permissions are loaded.
    console.log(`[rbac.global.js] User authenticated. Checking permissions for path: ${to.path}. Current isLoadingPermissions: ${isLoadingPermissions.value}, Permissions loaded: ${userPermissions.value.length > 0}`);

    if (!isLoadingPermissions.value && userPermissions.value.length === 0 && authUser.value?.id) {
        console.log(`[rbac.global.js] Permissions not loaded and not currently loading. Fetching for user ${authUser.value.id}...`);
        await fetchUserPermissions(); // Wait for permissions to be fetched
        console.log(`[rbac.global.js] Permissions fetch completed. isLoading: ${isLoadingPermissions.value}, Permissions count: ${userPermissions.value.length}`);
    } else if (isLoadingPermissions.value) {
        console.log(`[rbac.global.js] Permissions are currently loading. Setting up watcher to wait...`);
        await new Promise(resolve => {
            const unwatch = watch(isLoadingPermissions, (newValue) => {
                if (!newValue) {
                    console.log(`[rbac.global.js] Watcher: Permissions finished loading. isLoading: ${isLoadingPermissions.value}, Permissions count: ${userPermissions.value.length}`);
                    unwatch();
                    resolve();
                }
            });
            // Timeout for safety, in case isLoadingPermissions never becomes false
            setTimeout(() => {
                console.warn('[rbac.global.js] Watcher: Timeout waiting for permissions to load.');
                unwatch(); // Clean up watcher
                resolve(); // Proceed even if timeout, to prevent infinite loop
            }, 5000); // 5 second timeout
        });
    } else {
        console.log(`[rbac.global.js] Permissions already loaded or no user ID. Count: ${userPermissions.value.length}`);
    }
    // At this point, permissions should have been given a chance to load.

    // Check for base admin access permission
    const hasAdminDashboardAccess = can('admin:access_dashboard'); // This returns a computed ref
    console.log(`[rbac.global.js] Checking 'admin:access_dashboard'. User: ${authUser.value?.email}. Has permission (computed.value): ${hasAdminDashboardAccess.value}. Permissions list for check: ${JSON.stringify(userPermissions.value)}`);

    if (!hasAdminDashboardAccess.value) {
      console.log(`[rbac.global.js] User ${authUser.value?.email} lacks 'admin:access_dashboard' permission for ${to.path}. Redirecting to '/'.`);
      return navigateTo('/'); // Or '/admin/access-denied'
    }

    // Specific page permissions (examples)
    const usersViewPermission = can('users:view');
    console.log(`[RBAC] Checking 'users:view' for ${to.path}. Value: ${usersViewPermission.value}. All user permissions: ${JSON.stringify(userPermissions.value.map(p => p.name))}`);
    if (to.path.startsWith('/admin/users') && !usersViewPermission.value) {
      console.log(`[RBAC] User ${authUser.value?.email} lacks 'users:view' for ${to.path}. Redirecting to /admin.`);
      return navigateTo('/admin'); // Or '/admin/access-denied'
    }

    const productsViewPermission = can('products:view');
    console.log(`[RBAC] Checking 'products:view' for ${to.path}. Value: ${productsViewPermission.value}`);
    if (to.path.startsWith('/admin/products') && !productsViewPermission.value) {
      console.log(`[RBAC] User ${authUser.value?.email} lacks 'products:view' for ${to.path}. Redirecting to /admin.`);
      return navigateTo('/admin');
    }

    const rbacManagePermission = can('rbac:manage');
    console.log(`[RBAC] Checking 'rbac:manage' for ${to.path}. Value: ${rbacManagePermission.value}`);
    if (to.path.startsWith('/admin/roles') && !rbacManagePermission.value) {
      console.log(`[RBAC] User ${authUser.value?.email} lacks 'rbac:manage' for ${to.path}. Redirecting to /admin.`);
      return navigateTo('/admin');
    }

    const marketingSendEmailsPermission = can('marketing:send_emails');
    console.log(`[RBAC] Checking 'marketing:send_emails' for ${to.path}. Value: ${marketingSendEmailsPermission.value}`);
    if (to.path.startsWith('/admin/marketing') && !marketingSendEmailsPermission.value) {
      console.log(`[RBAC] User ${authUser.value?.email} lacks 'marketing:send_emails' for ${to.path}. Redirecting to /admin.`);
      return navigateTo('/admin');
    }

    // Example for orders, assuming 'orders:view_all' is the permission
    const ordersViewAllPermission = can('orders:view_all');
    console.log(`[RBAC] Checking 'orders:view_all' for ${to.path}. Value: ${ordersViewAllPermission.value}`);
    if (to.path.startsWith('/admin/orders') && !to.path.includes('shipping-label') && !ordersViewAllPermission.value) { // Ensure not to block shipping label printing if it has its own fine-grained perm
        console.log(`[RBAC] User ${authUser.value?.email} lacks 'orders:view_all' for ${to.path}. Redirecting to /admin.`);
        return navigateTo('/admin');
    }

    // Add more specific checks for other sections as needed...
    // e.g., /admin/taxes requires 'taxes:manage_classes' or 'taxes:manage_rates'

  } else if (to.path === '/login' && isAuthenticated.value) {
    // If user is authenticated and tries to go to login page, redirect to admin dashboard or home
    console.log('[RBAC] Authenticated user on login page. Redirecting to /admin.');
    return navigateTo('/admin');
  }

  // Allow navigation if none of the above conditions are met
  return;
});
