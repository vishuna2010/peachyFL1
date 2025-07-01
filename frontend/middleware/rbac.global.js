import { useAuth } from '~/composables/useAuth';
import { usePermissions } from '~/composables/usePermissions';
import { navigateTo } from '#app'; // Removed abortNavigation as it's not standard for blocking

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip RBAC checks for non-admin routes or during SSR if auth isn't fully resolved.
  if (process.server || !to.path.startsWith('/admin')) {
    // console.log(`[RBAC] Skipping for path: ${to.path}, server: ${process.server}`);
    return;
  }

  console.log(`[RBAC] Middleware triggered. Navigating from ${from.path} to: ${to.path}`);

  const { isAuthenticated, authUser, isAuthInitialized } = useAuth();
  const { can, isLoadingPermissions, userPermissions, fetchUserPermissions } = usePermissions();

  // Ensure auth is initialized before proceeding with RBAC checks on client
  if (!isAuthInitialized.value) {
    console.log(`[RBAC] Auth not yet initialized for ${to.path}. Waiting (this should be brief).`);
    // This simple await might not be enough if init takes time.
    // A more robust solution would involve a watcher or event from useAuth.
    await new Promise(resolve => {
        const unwatch = watch(isAuthInitialized, (isInit) => {
            if (isInit) {
                console.log(`[RBAC] Auth now initialized.`);
                unwatch();
                resolve();
            }
        });
         // Timeout for safety, in case isAuthInitialized never becomes true
        setTimeout(() => {
            console.warn('[RBAC] Timeout waiting for auth initialization.');
            unwatch(); // Clean up watcher
            resolve(); // Resolve promise to prevent indefinite blocking
        }, 2000); // 2 seconds timeout
    });
  }

  // If not authenticated (after init check), redirect to login, unless already on login
  if (!isAuthenticated.value) {
    if (to.path !== '/login') {
      console.log(`[RBAC] User not authenticated for admin path ${to.path}. Redirecting to login.`);
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    }
    console.log('[RBAC] User not authenticated, already on login page.');
    return; // Allow staying on login page
  }

  // User is authenticated. Now check permissions.
  console.log(`[RBAC] User ${authUser.value?.email} is authenticated. Checking permissions for ${to.path}.`);
  console.log(`  - isLoadingPermissions: ${isLoadingPermissions.value}`);

  // If permissions are not loaded and not currently loading, fetch them.
  if (userPermissions.value.size === 0 && !isLoadingPermissions.value) {
    console.warn(`[RBAC] Permissions set is empty for ${authUser.value?.email} and not loading. Attempting to fetch for ${to.path}.`);
    await fetchUserPermissions();
    console.log(`  - Permissions after explicit fetch attempt:`, JSON.stringify(Array.from(userPermissions.value)));
  }
  // If still loading after an attempt or was already loading.
  if (isLoadingPermissions.value) {
    console.log(`[RBAC] Permissions are still loading for ${to.path}. Waiting for permissions to load...`);
    await new Promise(resolve => {
        const unwatchPerms = watch(isLoadingPermissions, (loading) => {
            if (!loading) {
                console.log(`[RBAC] Watcher: Permissions finished loading for ${to.path}. Final count: ${userPermissions.value.size}`);
                unwatchPerms();
                resolve();
            }
        });
        setTimeout(() => { // Safety timeout
            console.warn(`[RBAC] Watcher: Timeout waiting for permissions to load for path ${to.path}.`);
            unwatchPerms();
            resolve();
        }, 3000); // 3 seconds timeout
    });
  }

  console.log(`  - Final check. User permissions list:`, JSON.stringify(Array.from(userPermissions.value)));

  // --- Route-Specific Permission Check (using to.meta.permission) ---
  const requiredPermission = to.meta.permission;
  console.log(`[RBAC] Required meta permission for ${to.path}: ${requiredPermission}`);

  if (requiredPermission) {
    if (!can(requiredPermission).value) {
      console.error(`[RBAC] Access DENIED to ${to.path}. User ${authUser.value?.email} lacks meta permission: "${requiredPermission}". Redirecting to /admin/unauthorized`);
      return navigateTo('/admin/unauthorized', { replace: true });
    }
    console.log(`[RBAC] Access GRANTED to ${to.path} via meta permission: "${requiredPermission}".`);
    return; // Permission granted
  }

  // --- Fallback/General Admin Access (if no specific meta.permission) ---
  // This part might be too broad or conflict if meta.permission is the standard.
  // For /admin dashboard, 'admin:access_dashboard' is a good check.
  if (to.path === '/admin' || to.path === '/admin/') {
    if (!can('admin:access_dashboard').value) {
      console.error(`[RBAC] Access DENIED to ${to.path}. User ${authUser.value?.email} lacks 'admin:access_dashboard' permission. Redirecting to / (homepage).`);
      return navigateTo('/', { replace: true }); // Or to a general unauthorized page
    }
    console.log(`[RBAC] Access GRANTED to ${to.path} via 'admin:access_dashboard' permission.`);
    return;
  }

  // If a route within /admin/* does not have a meta.permission,
  // it implies it might be accessible to anyone who passed admin-auth.
  // Or, you might want a default deny here if all admin sub-routes *must* have a permission.
  console.log(`[RBAC] No specific meta.permission for admin route ${to.path} and not the main dashboard. Allowing based on admin-auth completion.`);
});
