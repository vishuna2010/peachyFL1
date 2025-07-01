<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-neutral-bg-soft">
    <div class="p-8 bg-white shadow-xl rounded-lg text-center">
      <svg class="mx-auto h-12 w-12 text-peach-pink animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="mt-4 text-lg font-medium text-gray-700">Finalizing login...</p>
      <p class="text-sm text-gray-500">Please wait a moment.</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useRouter, useRoute } from '#app';

definePageMeta({
  layout: 'minimal', // A layout without headers/footers if you have one, or default
});

useHead({
  title: 'Authenticating...',
});

const { authUser, isAuthenticated, isAuthInitialized, isLoadingPermissions } = useAuth();
const router = useRouter();
const route = useRoute();

onMounted(() => {
  // console.log('[AuthCallback] Mounted. Initial state:',
  //   `isAuthInitialized: ${isAuthInitialized.value}`,
  //   `isAuthenticated: ${isAuthenticated.value}`,
  //   `isLoadingPermissions: ${isLoadingPermissions.value}`,
  //   `authUser permissions: ${JSON.stringify(authUser.value?.permissions)}`
  // );

  const stopWatch = watch(
    [isAuthInitialized, isAuthenticated, isLoadingPermissions, () => authUser.value?.permissions], // Watch all relevant states
    ([authInitialized, authenticated, loadingPermissions, permissionsArray]) => {
      // console.log('[AuthCallback] Watch triggered. State:',
      //   `isAuthInitialized: ${authInitialized}`,
      //   `isAuthenticated: ${authenticated}`,
      //   `isLoadingPermissions: ${loadingPermissions}`,
      //   `authUser permissions: ${JSON.stringify(permissionsArray)}`
      // );

      if (authInitialized && authenticated && !loadingPermissions) {
        // Ensure permissions array itself is also populated if expected
        // The check for permissionsArray?.length might be too strict if a user legitimately has no permissions.
        // The main thing is that isLoadingPermissions is false.

        stopWatch(); // Stop watching once conditions are met

        let intendedRedirect = route.query.redirect || '/'; // Fallback to homepage

        // Determine final target based on role and permissions, similar to login.vue
        const currentUser = authUser.value; // Re-access fresh state
        let finalTargetPath = intendedRedirect;

        if (intendedRedirect === '/admin' || intendedRedirect.startsWith('/admin/')) { // Only re-evaluate if original target was admin
            if (currentUser && currentUser.role && currentUser.role.toLowerCase().includes('admin')) {
                if (currentUser.permissions?.includes('admin:access_dashboard')) {
                    finalTargetPath = intendedRedirect === '/' || intendedRedirect === '/admin' ? '/admin' : intendedRedirect;
                } else if (currentUser.permissions?.length > 0) {
                    // If no dashboard access, but has other admin perms, maybe go to a specific page?
                    // For now, if original redirect was /admin and no dashboard access, they'll be stuck.
                    // This logic could be refined. If original redirect was specific like /admin/products, keep it.
                    finalTargetPath = (intendedRedirect === '/admin' || intendedRedirect === '/admin/') ? '/admin/unauthorized' : intendedRedirect;
                } else {
                     finalTargetPath = '/admin/unauthorized'; // No admin dashboard and no other permissions visible
                }
            } else { // Not an admin role, but tried to go to admin path
                finalTargetPath = '/';
            }
        } else if (intendedRedirect === '/') { // If default redirect was to home
             if (currentUser && currentUser.role && currentUser.role.toLowerCase().includes('admin') && currentUser.permissions?.includes('admin:access_dashboard')) {
                finalTargetPath = '/admin';
            } else {
                finalTargetPath = '/profile'; // Default for non-admin or if no specific redirect
            }
        }
        // If intendedRedirect was specific like /profile, it will be kept.

        // console.log(`[AuthCallback] Conditions met. Redirecting to: ${finalTargetPath} (original intended: ${route.query.redirect})`);
        router.replace(finalTargetPath);
      }
    },
    { immediate: true, deep: true } // immediate: true to check current state on mount
  );

  // Safety timeout in case the watch condition is never met (e.g., an error in auth flow)
  setTimeout(() => {
    stopWatch(); // Clean up watcher
    if (router.currentRoute.value.path === '/auth/callback') { // Check if still on callback page
        console.warn('[AuthCallback] Timeout reached. User may not be fully authenticated or permissions not loaded. Redirecting to homepage.');
        router.replace('/');
    }
  }, 5000); // 5 seconds timeout
});
</script>

<style scoped>
/* Add any specific styles if needed, or use Tailwind classes */
</style>
