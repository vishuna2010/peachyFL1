import { ref, onMounted } from 'vue';

export const useSiteSettings = () => {
  const settings = ref({});
  const loading = ref(true);
  const error = ref('');

  const fetchSettings = async () => {
    try {
      const { $axios } = useNuxtApp();
      const response = await $axios.get('/settings/public');
      settings.value = response.data.settings;
    } catch (err) {
      console.error('Error fetching site settings:', err);
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    fetchSettings();
  });

  return {
    settings,
    loading,
    error,
    fetchSettings
  };
}; 