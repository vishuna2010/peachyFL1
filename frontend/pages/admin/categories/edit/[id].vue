<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-xl mx-auto">
      <div class="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Edit Category</h1>
         <NuxtLink to="/admin/categories" class="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          &larr; Back to Categories
        </NuxtLink>
      </div>

      <div v-if="isFetching" class="text-center py-10">
        <p class="text-lg text-gray-500">Loading category details...</p>
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mt-4"></div>
      </div>
      <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
        <p>{{ fetchError }}</p>
      </div>

      <CategoryForm
        v-else
        :initial-data="categoryData"
        :is-edit-mode="true"
        :is-submitting="isSubmitting"
        :api-error="submitError"
        @submit="handleUpdate"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { useRouter, useRoute, useNuxtApp, useHead, definePageMeta } from '#imports';
import { useToast } from 'vue-toastification';
import CategoryForm from '~/components/admin/CategoryForm.vue';

definePageMeta({
  layout: 'admin',
});

const categoryData = reactive({ name: '', description: '' });
const isSubmitting = ref(false); // Renamed from isLoading for clarity
const isFetching = ref(true);
const fetchError = ref(null);
const submitError = ref('');


const router = useRouter();
const route = useRoute();
const toast = useToast();
const { $axios } = useNuxtApp();

const categoryId = route.params.id;

useHead({
  title: `Admin - Edit Category #${categoryId}`,
});

const fetchCategoryData = async () => {
  isFetching.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get(`/admin/categories/${categoryId}`);
    if (response.data) {
        categoryData.name = response.data.name || '';
        categoryData.description = response.data.description || '';
    } else {
        throw new Error('Invalid category data structure received from API.');
    }
  } catch (error) {
    console.error('Error fetching category data:', error);
    if (error.response && error.response.status === 404) {
      fetchError.value = `Category with ID #${categoryId} not found.`;
    } else if (error.response?.data?.message) {
      fetchError.value = error.response.data.message;
    } else {
      fetchError.value = 'An unexpected error occurred while fetching category details.';
    }
    toast.error(fetchError.value);
  } finally {
    isFetching.value = false;
  }
};

onMounted(() => {
  fetchCategoryData();
});

const handleUpdate = async (formData) => {
  isSubmitting.value = true;
  submitError.value = '';
  try {
    // The CategoryForm already ensures that initialData is compared for changes.
    // We just need to check if formData is different from what was fetched (categoryData)
    const nameChanged = formData.name !== categoryData.name;
    const descriptionChanged = formData.description !== categoryData.description;

    if (!nameChanged && !descriptionChanged) {
        toast.info('No changes detected to submit.');
        isSubmitting.value = false;
        return;
    }

    const payload = {};
    if (nameChanged) payload.name = formData.name;
    if (descriptionChanged) payload.description = formData.description;


    await $axios.put(`/admin/categories/${categoryId}`, payload);
    toast.success('Category updated successfully!');
    router.push('/admin/categories');
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.response?.data?.message) {
      submitError.value = error.response.data.message;
      toast.error(submitError.value);
    } else if (error.response?.data?.errors?.length > 0) {
      const messages = error.response.data.errors.map(e => e.msg).join(', ');
      submitError.value = messages;
      toast.error(messages);
    } else {
      submitError.value = 'An unexpected error occurred while updating the category.';
      toast.error(submitError.value);
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>
