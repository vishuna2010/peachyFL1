import { useAuth } from '~/composables/useAuth';
import { navigateTo } from '#app'; // watch is auto-imported or from 'vue'

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (process.server) {
    return;
  }

  const { isAuthenticated, authUser, isAuthInitialized, isLoadingPermissions } = useAuth();

  // console.log(`[RBAC] Navigating from ${from.fullPath} to ${to.fullPath}. AuthInit: ${isAuthInitialized.value}, AuthUser: ${!!authUser.value}, LoadingPerms: ${isLoadingPermissions.value}`);

  if (!to.path.startsWith('/admin')) {
    return;
  }

  // Wait for auth to be initialized
  if (!isAuthInitialized.value) {
    // console.log('[RBAC] Auth not initialized. Waiting...');
    await new Promise(resolve => {
      const unwatch = watch(isAuthInitialized, (value) => {
        if (value) {
          // console.log('[RBAC] Auth now initialized.');
          unwatch();
          resolve();
        }
      }, { immediate: false }); // immediate:false to wait for actual change
       // Safety timeout
      setTimeout(() => { if (unwatch) unwatch(); resolve(); }, 2000);
    });
  }

  if (!isAuthenticated.value) {
    if (to.path !== '/login') {
      // console.log(`[RBAC] Not authenticated for ${to.path}. Redirecting to login.`);
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    }
    return;
  }

  // console.log(`[RBAC] User ${authUser.value?.email} authenticated. Checking permissions for ${to.path}.`);
  // console.log(`[RBAC] isLoadingPermissions: ${isLoadingPermissions.value}`);
  // console.log(`[RBAC] Current authUser.value.permissions:`, JSON.stringify(authUser.value?.permissions));


  const needsPermCheck = to.meta.permission || to.path === '/admin' || to.path === '/admin/';
  let userPermissions = authUser.value?.permissions || [];

  if (needsPermCheck) {
    // First, wait if permissions are actively loading.
    if (isLoadingPermissions.value) {
      // console.log(`[RBAC] Permissions are actively loading for ${to.path}. Waiting for isLoadingPermissions to be false.`);
      await new Promise(resolve => {
        const unwatchLoading = watch(isLoadingPermissions, (loading) => {
          if (!loading) {
            // console.log('[RBAC] isLoadingPermissions is now false.');
            unwatchLoading();
            resolve();
          }
        }, { immediate: false }); // Only trigger when it changes to false
        setTimeout(() => { // Safety timeout
          // console.warn('[RBAC] Timeout waiting for isLoadingPermissions.');
          if (unwatchLoading) unwatchLoading();
          resolve();
        }, 3000);
      });
      // After isLoadingPermissions is false, authUser *should* have been updated by useAuth.
      // Give one more tick for that update to be fully reflected here.
      await nextTick();
      userPermissions = authUser.value?.permissions || [];
      // console.log(`[RBAC] Permissions after isLoadingPermissions wait for ${to.path}:`, JSON.stringify(userPermissions));
    }

    // If, after the above, permissions are *still* empty,
    // it implies isLoadingPermissions was already false, but authUser hadn't updated yet for RBAC.
    // This is the core race condition we're trying to solve.
    if (userPermissions.length === 0 && authUser.value && authUser.value.id && !isLoadingPermissions.value) {
      // console.log(`[RBAC] Permissions still empty for ${to.path} after initial checks (isLoadingPermissions is false). Awaiting one more tick.`);
      await nextTick();
      userPermissions = authUser.value?.permissions || []; // Re-check after the tick
      // console.log(`[RBAC] Permissions after final nextTick for ${to.path}:`, JSON.stringify(userPermissions));
    }
  }

  // console.log(`[RBAC] Final check for ${to.path}. User permissions:`, JSON.stringify(userPermissions));

  // --- Route-Specific Permission Check (using to.meta.permission) ---
  const requiredPermission = to.meta.permission;
  // console.log(`[RBAC] Required meta permission for ${to.path}: ${requiredPermission}`);

  if (requiredPermission) {
    if (!userPermissions.includes(requiredPermission)) {
      console.warn(`[RBAC] Access DENIED to ${to.path}. User ${authUser.value?.email} lacks meta permission: "${requiredPermission}". Permissions: ${JSON.stringify(userPermissions)}. Redirecting to /admin/unauthorized`);
      return navigateTo('/admin/unauthorized', { replace: true });
    }
    // console.log(`[RBAC] Access GRANTED to ${to.path} via meta permission: "${requiredPermission}".`);
    return;
  }

  // --- Fallback/General Admin Access ---
  if (to.path === '/admin' || to.path === '/admin/') {
    const dashboardPerm = 'admin:access_dashboard';
    if (!userPermissions.includes(dashboardPerm)) {
      console.warn(`[RBAC] Access DENIED to ${to.path}. User ${authUser.value?.email} lacks '${dashboardPerm}' permission. Permissions: ${JSON.stringify(userPermissions)}. Redirecting to / (homepage).`);
      return navigateTo('/', { replace: true });
    }
    // console.log(`[RBAC] Access GRANTED to ${to.path} via '${dashboardPerm}' permission.`);
    return;
  }

  // console.log(`[RBAC] No specific permission for ${to.path}. Allowing.`);
});
