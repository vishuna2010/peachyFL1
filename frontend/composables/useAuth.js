import { useState, useRouter } from '#app'; // Auto-imported by Nuxt

export const useAuth = () => {
  const { $axios } = useNuxtApp();
  const router = useRouter();

  // Reactive state for token and user
  // Using useState for simple global state within Nuxt's context
  const authToken = useState('authToken', () => null); // Persist in localStorage for better UX
  constauthUser = useState('authUser', () => null);   // Could also be persisted

  // Attempt to load token from localStorage on initialization (client-side)
  if (process.client) {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');
    if (storedToken) {
      authToken.value = storedToken;
      $axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    if (storedUser) {
      try {
        authUser.value = JSON.parse(storedUser);
      } catch (e) {
        console.error("Error parsing stored user", e);
        localStorage.removeItem('authUser'); // Clear corrupted data
      }
    }
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

  const login = async (email, password) => {
    try {
      const response = await $axios.post('/auth/login', { email, password });
      if (response.data.token) {
        setToken(response.data.token);
        // Optionally fetch user details here if not returned by /login
        // For now, let's assume login doesn't return full user details
        // or we can decode the token if it contains user info (not best practice for sensitive info)
        // For simplicity, we'll try to get user info from a hypothetical /auth/me endpoint
        await fetchUser();
        return { success: true };
      }
      return { success: false, message: 'Login failed: No token received.' };
    } catch (error) {
      console.error('Login error:', error.response?.data?.message || error.message);
      return { success: false, message: error.response?.data?.message || 'Login failed.' };
    }
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

  // Call fetchUser on init if token exists but user doesn't (e.g. after page reload)
  if (process.client && authToken.value && !authUser.value) {
    fetchUser();
  }

  return {
    authToken,
    authUser,
    login,
    register,
    logout,
    fetchUser // Expose if needed elsewhere
  };
};
