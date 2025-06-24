<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-xl mx-auto">
      <div class="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Add New Category</h1>
        <NuxtLink to="/admin/categories" class="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          &larr; Back to Categories
        </NuxtLink>
      </div>

      <CategoryForm
        :is-submitting="isSubmitting"
        :api-error="submitError"
        @submit="handleSubmit"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useNuxtApp, useHead, definePageMeta } from '#imports';
import { useToast } from 'vue-toastification';
import CategoryForm from '~/components/admin/CategoryForm.vue';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Add New Category',
});

const isSubmitting = ref(false);
const submitError = ref('');
const router = useRouter();
const toast = useToast();
const { $axios } = useNuxtApp();

const handleSubmit = async (formData) => {
  isSubmitting.value = true;
  submitError.value = '';
  try {
    await $axios.post('/admin/categories', formData);
    toast.success('Category added successfully!');
    router.push('/admin/categories');
  } catch (error) {
    console.error('Error adding category:', error);
    if (error.response?.data?.message) {
      submitError.value = error.response.data.message;
      toast.error(submitError.value);
    } else if (error.response?.data?.errors?.length > 0) {
      const messages = error.response.data.errors.map(e => e.msg).join(', ');
      submitError.value = messages;
      toast.error(messages);
    } else {
      submitError.value = 'An unexpected error occurred while adding the category.';
      toast.error(submitError.value);
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>
