import { ref, computed } from 'vue';
import { useAuth } from '~/composables/useAuth'; // To react to auth changes
import { useNuxtApp } from '#app';

const userPermissions = ref(new Set()); // Use a Set for efficient lookups
const isLoadingPermissions = ref(false);
const permissionError = ref(null);

export function usePermissions() {
  const { $axios } = useNuxtApp();
  const { isAuthenticated, authUser } = useAuth(); // Get auth state

  async function fetchUserPermissions() {
    if (!isAuthenticated.value || !authUser.value?.id) {
      // console.log('[usePermissions] Not authenticated or no user ID, clearing permissions.');
      clearUserPermissions();
      return;
    }

    // console.log('[usePermissions] Fetching permissions for user:', authUser.value.id);
    isLoadingPermissions.value = true;
    permissionError.value = null;
    try {
      const response = await $axios.get('/auth/my-permissions'); // Path relative to baseURL
      if (response.data && Array.isArray(response.data.permissions)) {
        userPermissions.value = new Set(response.data.permissions);
        // console.log('[usePermissions] Permissions fetched:', Array.from(userPermissions.value));
      } else {
        console.warn('[usePermissions] Unexpected response structure for permissions:', response.data);
        userPermissions.value = new Set(); // Ensure it's a Set even if empty/error
      }
    } catch (err) {
      console.error('[usePermissions] Error fetching user permissions:', err);
      permissionError.value = err.response?.data?.message || err.message || 'Failed to load permissions.';
      userPermissions.value = new Set(); // Clear permissions on error
    } finally {
      isLoadingPermissions.value = false;
    }
  }

  function clearUserPermissions() {
    // console.log('[usePermissions] Clearing user permissions.');
    userPermissions.value.clear();
    // userPermissions.value = new Set(); // Re-assign to trigger reactivity if needed by some components, though Set.clear() should be fine.
  }

  const can = (permissionName) => {
    return computed(() => {
      if (!permissionName || typeof permissionName !== 'string') {
        // console.warn('[usePermissions] `can()` called with invalid permissionName:', permissionName);
        return false;
      }
      // console.log(`[usePermissions] Checking permission: ${permissionName}, Has: ${userPermissions.value.has(permissionName)}`);
      return userPermissions.value.has(permissionName);
    });
  };

  // --- Integration with useAuth ---
  // This requires useAuth to expose an event or watcher, or for this to be called from useAuth.
  // For simplicity here, we assume useAuth might call fetchUserPermissions on login
  // and clearUserPermissions on logout.
  // A more robust way is to watch isAuthenticated or a specific login/logout event.

  // Watch for authentication changes to fetch/clear permissions
  // This might run multiple times if isAuthenticated changes frequently during init.
  // Consider a more robust event-driven approach or managing this call from useAuth itself.
  if (process.client) { // Only run watchers on client-side
    watch(isAuthenticated, async (isAuth) => {
      // console.log('[usePermissions] isAuthenticated watcher triggered. New state:', isAuth);
      if (isAuth && authUser.value?.id) {
        await fetchUserPermissions();
      } else {
        clearUserPermissions();
      }
    }, { immediate: false }); // 'immediate: false' to avoid running on initial undefined -> false if not desired.
                           // Or 'immediate: true' if you want it to run once on setup.
                           // Given useAuth initialization, immediate might be better.
                           // Let's try immediate: true and see.
                           // Update: immediate might cause issues if $axios is not ready, or if authUser is not yet populated.
                           // Let's make it non-immediate and rely on useAuth to trigger first fetch after login.
                           // A common pattern is for useAuth to call fetchUserPermissions after successful login/token validation.
  }


  // Initial fetch if already authenticated (e.g., on page refresh with valid token)
  // This should ideally be called by useAuth after it confirms existing session.
  // if (process.client && isAuthenticated.value && authUser.value?.id && userPermissions.value.size === 0) {
  //    console.log('[usePermissions] Initial fetch on client because user is authenticated.');
  //    fetchUserPermissions();
  // }


  return {
    userPermissions: computed(() => Array.from(userPermissions.value)), // Expose as array for easier iteration if needed
    isLoadingPermissions,
    permissionError,
    fetchUserPermissions,
    clearUserPermissions,
    can,
  };
}
