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
  const _initializeAuth = () => {
    if (process.client && !isAuthInitialized.value) {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');
    if (storedToken) {
      authToken.value = storedToken;
      if (storedToken) { // Set Axios header only if token actually exists
          $axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }
    }
    if (storedUser) {
      try {
        authUser.value = JSON.parse(storedUser);
      } catch (e) {
        console.error("Error parsing stored user", e);
        localStorage.removeItem('authUser');
      }
    }
    isAuthInitialized.value = true;
    console.log('Auth initialized. Token:', !!authToken.value, 'User:', !!authUser.value);
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
    if (!authToken.value) return; // No token, no user to fetch
    try {
      // This endpoint doesn't exist yet, we'd need to create it.
      // It would typically validate the token and return user info.
      // For now, we can simulate or decode from token if it's simple enough.
      // Or, if login returned user info, we'd use that.
      // Let's assume for now the backend /auth/login returns user or we add a /auth/me
      // For this example, let's try to extract basic info if the token is a simple JWT
      // THIS IS NOT SECURE FOR REAL APPS if the payload is not verified.
      // A /me endpoint is the correct approach.
      const payload = JSON.parse(atob(authToken.value.split('.')[1]));
      if (payload && payload.email) {
        setUser({ email: payload.email, id: payload.userId });
      } else {
        // Placeholder if token doesn't have email directly (which it should for this example)
        // setUser({ email: 'User' }); // Or fetch from a /api/auth/me endpoint
        console.warn("User data not found in token, consider a /api/auth/me endpoint.");
      }
    } catch (error) {
      console.error('Error fetching user data (or decoding token):', error);
      // Could be an invalid token, so log out
      // logout();
    }
  };


  const logout = () => {
    setToken(null);
    setUser(null);
    if (process.client) { // Ensure router is only used client-side initially
        router.push('/login');
    }
  };

  // Call fetchUser on init if token exists but user doesn't (e.g. after page reload and _initializeAuth)
  if (process.client && authToken.value && !authUser.value && isAuthInitialized.value) {
     // Check isAuthInitialized to ensure this doesn't run before localStorage load attempt
    fetchUser();
  }

  return {
    authToken: computed(() => authToken.value), // Expose as computed for read-only pattern
    authUser: computed(() => authUser.value),
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
