// Nuxt 3 auto-imports composables like useState, useRouter, useNuxtApp, useRuntimeConfig, nextTick
// No explicit import needed from '#app' for these in most cases.

export const useAuth = () => {
  const { $axios } = useNuxtApp();
  const router = useRouter();
  const config = useRuntimeConfig(); // Get runtime config

  // Reactive state for token and user
  // Using useState for simple global state within Nuxt's context
  const authToken = useState('authToken', () => null);
  const authUser = useState('authUser', () => null);
  const isAuthInitialized = useState('isAuthInitialized', () => false); // Flag to track initial load
  const isLoadingPermissions = useState('isLoadingPermissions', () => false);


  const _fetchUserPermissions = async () => {
    if (!authToken.value || !authUser.value || !authUser.value.id) {
      console.log('useAuth: Cannot fetch permissions without token or user ID.');
      return;
    }
    isLoadingPermissions.value = true;
    console.log('useAuth: Fetching user permissions...');
    try {
      // Path should be relative to the /api baseURL
      console.log(`useAuth: Attempting to fetch permissions from /auth/my-permissions`);
      const response = await $axios.get('/auth/my-permissions'); // Corrected: was /api/auth/my-permissions in my mental model, but should be this if baseURL is /api
      if (response.data && response.data.permissions) {
        if (authUser.value) { // Ensure authUser still exists
          const updatedUser = { ...authUser.value, permissions: response.data.permissions };
          setUser(updatedUser); // Use setUser to also update localStorage
          console.log('useAuth: User permissions fetched and set:', response.data.permissions);
          await nextTick(); // Ensure reactivity propagates before isLoadingPermissions is set to false
        }
      } else {
        console.warn('useAuth: Permissions not found in /api/auth/my-permissions response.');
        if (authUser.value) {
          const updatedUser = { ...authUser.value, permissions: [] }; // Default to empty array
          setUser(updatedUser);
          await nextTick();
        }
      }
    } catch (error) {
      console.error('useAuth: Error fetching user permissions:', error.response?.data?.message || error.message);
      if (authUser.value) {
        const updatedUser = { ...authUser.value, permissions: [] }; // Default to empty array on error
        setUser(updatedUser);
        await nextTick();
      }
      // Optionally handle specific errors, e.g., 401 might require logout
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('useAuth: Unauthorized fetching permissions. Logging out.');
        // Consider if logout is appropriate or if permissions are just optional enhancement
        // For RBAC, permissions are critical, so logout might be too aggressive if basic user info is still valid.
        // For now, we just ensure permissions array is empty or not set.
      }
    } finally {
      await nextTick(); // Ensure reactive updates from try/catch (setUser) propagate
      isLoadingPermissions.value = false;
    }
  };


  // Attempt to load token from localStorage on initialization (client-side)
  const _initializeAuth = async () => {
    if (process.client && !isAuthInitialized.value) {
      console.log('useAuth: Starting initialization...');

      const storedToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('authUser');

      console.log('useAuth: Stored data from localStorage:', {
        hasToken: !!storedToken,
        hasUser: !!storedUser,
        tokenLength: storedToken?.length,
        userData: storedUser ? JSON.parse(storedUser) : null
      });

      if (storedToken) {
        authToken.value = storedToken;
        $axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        console.log('useAuth: Token loaded from localStorage and Axios header set.');
      } else {
        console.log('useAuth: No token found in localStorage.');
      }

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          // Ensure permissions are initialized as an array if not present from old localStorage
          if (!parsedUser.permissions) {
            parsedUser.permissions = [];
          }
          authUser.value = parsedUser;
          console.log('useAuth: User data loaded from localStorage:', authUser.value);
        } catch (e) {
          console.error("useAuth: Error parsing stored user, removing item.", e);
          localStorage.removeItem('authUser');
          authUser.value = null;
        }
      } else {
        console.log('useAuth: No user data found in localStorage.');
      }

      isAuthInitialized.value = true;
      console.log('useAuth: Initialization complete. isAuthInitialized set to true. Token:', !!authToken.value, 'User:', !!authUser.value);

      if (authToken.value) {
        if (!authUser.value || !authUser.value.id) { // If user data is incomplete or missing
          console.log('useAuth: Token present but user data missing/incomplete after init. Fetching user...');
          await fetchUser(); // This will also trigger _fetchUserPermissions if successful
        } else if (authUser.value && (!authUser.value.permissions || authUser.value.permissions.length === 0)) {
          // User data loaded, but permissions might be missing (e.g. from older localStorage) or need refresh
          console.log('useAuth: User data present, but permissions might be missing. Fetching permissions...');
          await _fetchUserPermissions();
        } else {
           console.log('useAuth: Token and user data (including permissions) present after init.');
        }
      } else {
        console.log('useAuth: No token after init. No immediate fetch needed.');
      }
    } else if (process.client && isAuthInitialized.value) {
      console.log('useAuth: Initialization already completed.');
    }
  };

  if (process.client && !isAuthInitialized.value) {
    _initializeAuth();
  }

  const setToken = (newToken) => {
    authToken.value = newToken;
    if (process.client) {
      if (newToken) {
        localStorage.setItem('authToken', newToken);
        $axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      } else {
        localStorage.removeItem('authToken');
        delete $axios.defaults.headers.common['Authorization'];
      }
    }
  };

  const setUser = (newUser) => {
    authUser.value = newUser;
     if (process.client) {
      if (newUser) {
        localStorage.setItem('authUser', JSON.stringify(newUser));
      } else {
        localStorage.removeItem('authUser');
      }
    }
  };

  // This login function is now primarily for direct, non-2FA login if ever needed,
  // or can be deprecated if login page handles API calls directly.
  // For this refactor, we'll keep it but note its diminished role for the login page.
  // The login page will call API directly then call loginSuccess.
  // async function login(email, password) { ... } // Original login logic might be removed or adapted

  const loginSuccess = async (apiResponseData) => { // Made async
    // Expects apiResponseData to be { token, user }
    if (apiResponseData.token && apiResponseData.user) {
      setToken(apiResponseData.token);
      // Set basic user data first
      const basicUser = { ...apiResponseData.user, permissions: [] }; // Initialize with empty permissions
      setUser(basicUser);
      console.log('Login successful, basic user set:', authUser.value);

      // After setting basic user, fetch their permissions
      await _fetchUserPermissions(); // await the permission fetching

      return true;
    }
    console.error('loginSuccess called with invalid data:', apiResponseData);
    return false;
  };


  const register = async (email, password) => {
    try {
      const response = await $axios.post('/auth/register', { email, password });
      
      // Check if registration was successful
      if (response.status === 201 && response.data.message) {
        return { 
          success: true, 
          message: response.data.message || 'Registration successful! Please check your email to verify your account.' 
        };
      }
      
      return { success: false, message: response.data.message || 'Registration failed.' };
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle different types of errors
      if (error.response) {
        // Server responded with error status
        const errorMessage = error.response.data?.message || 'Registration failed.';
        return { success: false, message: errorMessage };
      } else if (error.request) {
        // Network error
        return { success: false, message: 'Network error. Please check your connection and try again.' };
      } else {
        // Other error
        return { success: false, message: 'An unexpected error occurred. Please try again.' };
      }
    }
  };

  const fetchUser = async () => {
    if (!authToken.value) {
      return;
    }
    console.log('useAuth: Attempting to fetch user data from /auth/me');
    try {
      const response = await $axios.get('/auth/me'); // Path relative to /api baseURL
      if (response.data && response.data.user) {
        // Set basic user data first, ensure permissions array exists
        const basicUser = { ...response.data.user, permissions: authUser.value?.permissions || [] };
        setUser(basicUser);
        console.log('useAuth: Basic user data fetched and set:', authUser.value);

        // After setting basic user, fetch their permissions
        await _fetchUserPermissions();
      } else {
        console.warn('useAuth: User data not found in /api/auth/me response.');
        setUser(null); // Clear user if /me fails to return valid data
      }
    } catch (error) {
      console.error('useAuth: Error fetching user data from /api/auth/me:', error.response?.data?.message || error.message);
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('useAuth: Unauthorized fetching user data. Logging out.');
        logout();
      } else {
        setUser(null); // Clear user on other errors too
      }
    }
  };


  const logout = () => {
    setToken(null);
    setUser(null);
    isLoadingPermissions.value = false; // Reset loading state on logout
    if (process.client) {
        router.push('/login');
    }
  };

  const isAuthenticated = computed(() => !!authToken.value && !!authUser.value && !!authUser.value.id); // Check for user.id too

  return {
    authToken: computed(() => authToken.value),
    authUser: computed(() => authUser.value),
    isAuthenticated,
    isAuthInitialized: computed(() => isAuthInitialized.value),
    isLoadingPermissions: computed(() => isLoadingPermissions.value), // Expose this
    loginSuccess,
    register,
    logout,
    fetchUser,
  };
};
