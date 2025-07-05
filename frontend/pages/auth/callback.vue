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
import { onMounted, onUnmounted, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useRouter, useRoute } from '#app';

definePageMeta({
  layout: false,
});

useHead({
  title: 'Authenticating...',
});

const { authUser, isAuthenticated, isAuthInitialized, isLoadingPermissions } = useAuth();
const router = useRouter();
const route = useRoute();

onMounted(() => {
  console.log('[AuthCallback] Mounted. Initial state:',
    `isAuthInitialized: ${isAuthInitialized.value}`,
    `isAuthenticated: ${isAuthenticated.value}`,
    `isLoadingPermissions: ${isLoadingPermissions.value}`,
    `authUser: ${JSON.stringify(authUser.value)}`
  );

  let stopWatch = null;

  stopWatch = watch(
    [isAuthInitialized, isAuthenticated, isLoadingPermissions, () => authUser.value?.permissions],
    ([authInitialized, authenticated, loadingPermissions, permissionsArray]) => {
      console.log('[AuthCallback] Watch triggered. State:',
        `isAuthInitialized: ${authInitialized}`,
        `isAuthenticated: ${authenticated}`,
        `isLoadingPermissions: ${loadingPermissions}`,
        `authUser: ${JSON.stringify(authUser.value)}`,
        `permissions: ${JSON.stringify(permissionsArray)}`
      );

      if (authInitialized && authenticated && !loadingPermissions) {
        console.log('[AuthCallback] All conditions met! Proceeding with redirect...');
        
        if (stopWatch) {
          stopWatch();
        }

        let intendedRedirect = route.query.redirect?.toString() || '';
        console.log(`[AuthCallback] Intended redirect: ${intendedRedirect}`);

        const currentUser = authUser.value;
        let finalTargetPath = intendedRedirect;

        // If no specific redirect or redirect is to home, determine based on user role
        if (!intendedRedirect || intendedRedirect === '/' || intendedRedirect === '') {
          if (currentUser && currentUser.role && currentUser.role.toLowerCase().includes('admin')) {
            // Admin users should go to admin dashboard by default
            finalTargetPath = '/admin';
            console.log('[AuthCallback] Admin user detected, redirecting to /admin');
          } else {
            // Non-admin users go to profile
            finalTargetPath = '/profile';
            console.log('[AuthCallback] Non-admin user detected, redirecting to /profile');
          }
        } else if (intendedRedirect.startsWith('/admin')) {
          // If trying to access admin area, verify permissions
          if (currentUser && currentUser.role && currentUser.role.toLowerCase().includes('admin')) {
            if (currentUser.permissions?.includes('admin:access_dashboard')) {
              finalTargetPath = intendedRedirect;
            } else {
              finalTargetPath = '/admin/unauthorized';
            }
          } else {
            finalTargetPath = '/';
          }
        }

        console.log(`[AuthCallback] Final redirect target: ${finalTargetPath}`);
        router.replace(finalTargetPath);
      } else {
        console.log('[AuthCallback] Conditions not met yet:', {
          authInitialized,
          authenticated,
          loadingPermissions,
          userExists: !!currentUser,
          userRole: currentUser?.role
        });
      }
    },
    { immediate: true, deep: true }
  );

  // Safety timeout
  const safetyTimeout = setTimeout(() => {
    if (stopWatch) {
      stopWatch();
    }
    if (router.currentRoute.value.path === '/auth/callback') {
      console.warn('[AuthCallback] Timeout reached. Current state:', {
        isAuthInitialized: isAuthInitialized.value,
        isAuthenticated: isAuthenticated.value,
        isLoadingPermissions: isLoadingPermissions.value,
        authUser: authUser.value
      });
      console.warn('[AuthCallback] Redirecting to homepage due to timeout.');
      router.replace('/');
    }
  }, 10000); // Increased timeout to 10 seconds

  onUnmounted(() => {
    clearTimeout(safetyTimeout);
    if (stopWatch) {
      stopWatch();
    }
  });
});
</script>

<style scoped>
/* Add any specific styles if needed, or use Tailwind classes */
</style>
