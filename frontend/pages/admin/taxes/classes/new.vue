<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-xl mx-auto">
      <h1 class="text-2xl font-semibold text-gray-900 mb-6">Create New Tax Class</h1>

      <form @submit.prevent="handleSubmit" class="bg-white shadow-md rounded-lg p-6 border border-gray-200 space-y-6">
        <div>
          <label for="className" class="block text-sm font-medium text-gray-700 mb-1">
            Tax Class Name <span class="text-red-500">*</span>
          </label>
          <input type="text" id="className" v-model.trim="className" required
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
                 :disabled="isLoading"
                 placeholder="e.g., Standard Rate, Reduced Rate, Zero Rate">
        </div>

        <div>
          <label for="classDescription" class="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea id="classDescription" v-model.trim="classDescription" rows="3"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
                    :disabled="isLoading"
                    placeholder="Brief description of when this tax class applies"></textarea>
        </div>

        <div class="mt-8 flex items-center justify-end space-x-4 pt-2 border-t border-gray-200">
          <NuxtLink to="/admin/taxes/classes"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Cancel
          </NuxtLink>
          <button type="submit" :disabled="isLoading"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            <span v-if="isLoading">Creating...</span>
            <span v-else>Create Tax Class</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRouter } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - New Tax Class' });

const { $axios } = useNuxtApp();
const router = useRouter();
const toast = useToast();

const className = ref('');
const classDescription = ref('');
const isLoading = ref(false);

const handleSubmit = async () => {
  isLoading.value = true;

  if (!className.value.trim()) {
    toast.error('Tax Class Name is required.');
    isLoading.value = false;
    return;
  }

  const payload = {
    name: className.value.trim(),
    description: classDescription.value.trim() || null, // Send null if description is empty
  };

  try {
    await $axios.post('/admin/tax-classes', payload);
    toast.success('Tax class created successfully!');
    router.push('/admin/taxes/classes');
  } catch (error) {
    console.error('Error creating tax class:', error);
    const errorMessage = error.response?.data?.message ||
                         (error.response?.data?.errors?.[0]?.msg ? `Validation error: ${error.response.data.errors[0].msg}` : 'Failed to create tax class.');
    toast.error(errorMessage);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
/* Using global Tailwind classes. Specific styling can be added here if needed. */
.form-input { /* Base class for inputs/textareas, can be applied directly or via @apply in a style tag */
  /* Ensure this matches the Tailwind classes used directly on elements or define it in a global CSS file */
}
.btn-primary {
 /* Ensure this matches the Tailwind classes used directly on elements or define it in a global CSS file */
}
.btn-secondary {
  /* Ensure this matches the Tailwind classes used directly on elements or define it in a global CSS file */
}
</style>
