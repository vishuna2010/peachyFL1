export const useApi = () => {
  const { $toast } = useNuxtApp()
  
  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken')
    return token ? { 'Authorization': `Bearer ${token}` } : {}
  }

  const apiFetch = async (url, options = {}) => {
    const config = useRuntimeConfig()
    const fullUrl = url.startsWith('http') ? url : `${config.public.backendBaseUrl}${url}`
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers
      }
    }

    try {
      const response = await $fetch(fullUrl, {
        ...defaultOptions,
        ...options
      })
      return response
    } catch (error) {
      console.error('API Error:', error)
      if (error.status === 401) {
        // Handle unauthorized - redirect to login
        navigateTo('/login')
      }
      throw error
    }
  }

  return {
    apiFetch
  }
} 