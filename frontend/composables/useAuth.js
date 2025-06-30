import { useState, useRouter } from '#app'; // Auto-imported by Nuxt

export const useAuth = () => {
  const { $axios } = useNuxtApp();
  const router = useRouter();

  // Reactive state for token and user
  // Using useState for simple global state within Nuxt's context
  const authToken = useState('authToken', () => null);
  const authUser = useState('authUser', () => null);
  const isAuthInitialized = useState('isAuthInitialized', () => false); // Flag to track initial load

  // Attempt to load token from localStorage on initialization (client-side)
  const _initializeAuth = async () => {
    if (process.client && !isAuthInitialized.value) { // Check prevents re-running if already initialized
      console.log('useAuth: Starting initialization...');
      // Explicitly ensure isAuthInitialized is false until fully done
      // This helps if this function is called multiple times before completion.
      // However, the outer check `!isAuthInitialized.value` should prevent re-entry.
      // isAuthInitialized.value = false;

      const storedToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('authUser');

      if (storedToken) {
        authToken.value = storedToken;
        $axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        console.log('useAuth: Token loaded from localStorage and Axios header set.');
      } else {
        console.log('useAuth: No token found in localStorage.');
      }

      if (storedUser) {
        try {
          authUser.value = JSON.parse(storedUser);
          console.log('useAuth: User data loaded from localStorage.');
        } catch (e) {
          console.error("useAuth: Error parsing stored user, removing item.", e);
          localStorage.removeItem('authUser');
          authUser.value = null; // Ensure authUser is reset
        }
      } else {
        console.log('useAuth: No user data found in localStorage.');
      }

      // Crucially, set isAuthInitialized to true only AFTER all sync operations are done.
      isAuthInitialized.value = true;
      console.log('useAuth: Initialization complete. isAuthInitialized set to true. Token:', !!authToken.value, 'User:', !!authUser.value);

      // Now, after initialization is complete and token is potentially loaded,
      // decide if fetchUser needs to be called.
      if (authToken.value && !authUser.value) {
        console.log('useAuth: Token present but user data missing after init. Fetching user...');
        await fetchUser(); // fetchUser is async, so await it.
      } else if (authToken.value && authUser.value) {
        console.log('useAuth: Token and user data both present after init. No immediate fetch needed.');
      } else {
        console.log('useAuth: No token or no user after init. No immediate fetch needed.');
      }
    } else if (process.client && isAuthInitialized.value) {
      console.log('useAuth: Initialization already completed.');
    }
  };

  // Call _initializeAuth when the composable is first set up on the client.
  // This structure ensures it's called once.
  if (process.client && !isAuthInitialized.value) {
    // No await here, as composable setup is synchronous.
    // Components will watch isAuthInitialized.
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

  const loginSuccess = (apiResponseData) => {
    // Expects apiResponseData to be { token, user }
    if (apiResponseData.token && apiResponseData.user) {
      setToken(apiResponseData.token);
      setUser(apiResponseData.user); // Assuming user object from API is safe to store
                                     // (e.g., excludes password, sensitive fields)
      console.log('Login successful, user set:', authUser.value);
      // router.push(router.currentRoute.value.query.redirect || '/profile'); // Moved to page
      return true;
    }
    console.error('loginSuccess called with invalid data:', apiResponseData);
    return false;
  };


  const register = async (email, password) => {
    try {
      const response = await $axios.post('/auth/register', { email, password });
      // Assuming registration returns the user object (excluding password)
      if (response.data.user && response.data.message === 'User registered successfully.') {
         // Do not automatically log in the user, let them log in separately
        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data.message || 'Registration failed.' };
    } catch (error) {
      console.error('Registration error:', error.response?.data?.message || error.message);
      return { success: false, message: error.response?.data?.message || 'Registration failed.' };
    }
  };

  const fetchUser = async () => {
    if (!authToken.value) {
      // console.log('fetchUser: No auth token found.');
      return; // No token, no user to fetch
    }
    // console.log('fetchUser: Attempting to fetch user data from /api/auth/me');
    try {
      const response = await $axios.get('/api/auth/me'); // Use $axios from useNuxtApp()
      if (response.data && response.data.user) {
        setUser(response.data.user); // The /me endpoint returns { user: { id, email, role, ... } }
        // console.log('fetchUser: User data fetched and set:', response.data.user);
      } else {
        // This case might indicate an issue with the /me endpoint's response structure
        // or if the token is valid but user data can't be retrieved for some reason.
        console.warn('fetchUser: User data not found in /api/auth/me response, or response structure is unexpected.');
        // Potentially clear user state if response is malformed or indicates an issue
        // setUser(null); // Or handle as an error state
      }
    } catch (error) {
      console.error('fetchUser: Error fetching user data from /api/auth/me:', error.response?.data?.message || error.message);
      // If the error is 401 (Unauthorized) or similar, it means the token is invalid or expired.
      // In this case, we should log the user out.
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('fetchUser: Unauthorized or invalid token. Logging out.');
        logout(); // Call the logout function from useAuth
      }
      // Do not call setUser(null) here if logout() already does it, to avoid duplicate actions.
      // logout() should handle clearing token and user state.
    }
  };


  const logout = () => {
    setToken(null);
    setUser(null);
    if (process.client) { // Ensure router is only used client-side initially
        router.push('/login');
    }
  };

  const isAuthenticated = computed(() => !!authToken.value && !!authUser.value);

  return {
    authToken: computed(() => authToken.value), // Expose as computed for read-only pattern
    authUser: computed(() => authUser.value),
    isAuthenticated, // Export the new computed property
    isAuthInitialized: computed(() => isAuthInitialized.value), // Expose initialization status
    // login, // Original login function might be deprecated for page-level handling
    loginSuccess, // New function to finalize login
    register,
    logout,
    fetchUser,
    // Expose setters if direct manipulation from outside is ever needed, though typically not.
    // _setToken: setToken,
    // _setUser: setUser,
  };
};
