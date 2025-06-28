<template>
  <div>
    <h1 class="text-2xl font-semibold text-gray-800 dark:text-neutral-200">Marketing Campaigns</h1>
    <p class="mt-1 text-sm text-gray-600 dark:text-neutral-400">
      Create and manage your marketing email campaigns.
    </p>

    <div class="mt-6 bg-white dark:bg-neutral-800 shadow-md rounded-lg p-6">
      <h2 class="text-xl font-medium text-gray-700 dark:text-neutral-300 mb-6">Send New Promotional Email</h2>

      <form @submit.prevent="handleSendPromotion">
        <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <!-- Subject -->
          <div class="sm:col-span-6">
            <label for="subject" class="block text-sm font-medium text-gray-700 dark:text-neutral-300">Subject</label>
            <input type="text" v-model="form.subject" id="subject" required
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md shadow-sm focus:ring-sky-blue focus:border-sky-blue sm:text-sm dark:bg-neutral-700 dark:text-neutral-50">
          </div>

          <!-- Promotional Title (Optional) -->
          <div class="sm:col-span-6">
            <label for="promoTitle" class="block text-sm font-medium text-gray-700 dark:text-neutral-300">Promotional Title (Optional)</label>
            <input type="text" v-model="form.promoTitle" id="promoTitle"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md shadow-sm focus:ring-sky-blue focus:border-sky-blue sm:text-sm dark:bg-neutral-700 dark:text-neutral-50">
          </div>

          <!-- Promotional Message Body -->
          <div class="sm:col-span-6">
            <label for="promoMessageBody" class="block text-sm font-medium text-gray-700 dark:text-neutral-300">Promotional Message Body (HTML allowed)</label>
            <textarea v-model="form.promoMessageBody" id="promoMessageBody" rows="6" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md shadow-sm focus:ring-sky-blue focus:border-sky-blue sm:text-sm dark:bg-neutral-700 dark:text-neutral-50"></textarea>
            <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">You can use HTML tags for formatting.</p>
          </div>

          <!-- CTA Link -->
          <div class="sm:col-span-3">
            <label for="ctaLink" class="block text-sm font-medium text-gray-700 dark:text-neutral-300">CTA Link (Full URL)</label>
            <input type="url" v-model="form.ctaLink" id="ctaLink" required placeholder="https://example.com/promo"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md shadow-sm focus:ring-sky-blue focus:border-sky-blue sm:text-sm dark:bg-neutral-700 dark:text-neutral-50">
          </div>

          <!-- CTA Text -->
          <div class="sm:col-span-3">
            <label for="ctaText" class="block text-sm font-medium text-gray-700 dark:text-neutral-300">CTA Button Text</label>
            <input type="text" v-model="form.ctaText" id="ctaText" required
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md shadow-sm focus:ring-sky-blue focus:border-sky-blue sm:text-sm dark:bg-neutral-700 dark:text-neutral-50">
          </div>
        </div>

        <div class="mt-8 pt-5 border-t border-gray-200 dark:border-neutral-700">
          <div class="flex justify-end">
            <button type="submit"
                    :disabled="isSending"
                    class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-blue hover:bg-sky-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-blue-dark disabled:opacity-50 dark:bg-sky-blue dark:hover:bg-sky-blue-light dark:focus:ring-sky-blue-light">
              <span v-if="isSending">Sending...</span>
              <span v-else>Send Promotional Email</span>
            </button>
          </div>
        </div>
      </form>

      <!-- Response Message Area -->
      <div v-if="responseMessage" class="mt-6 p-4 rounded-md" :class="isError ? 'bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200' : 'bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-200'">
        <p class="text-sm font-medium">{{ responseMessage.title }}</p>
        <p v-if="responseMessage.details" class="text-xs mt-1">{{ responseMessage.details }}</p>
        <ul v-if="responseMessage.errors && responseMessage.errors.length" class="list-disc list-inside text-xs mt-1">
          <li v-for="(err, index) in responseMessage.errors" :key="index">{{ err.msg || err }}</li>
        </ul>
      </div>

    </div>

    <!-- Future sections for campaign lists, analytics, etc. can be added below -->
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'rbac'],
  requiredPermission: 'marketing:send_emails' // Or a more general 'marketing:access_section'
});

useHead({
  title: 'Marketing Campaigns - Admin',
});

import { ref } from 'vue';
const { $api } = useNuxtApp(); // Common way to access global API instance in Nuxt 3

const form = ref({
  subject: '',
  promoTitle: '',
  promoMessageBody: '',
  ctaLink: '',
  ctaText: '',
});

const isSending = ref(false);
const responseMessage = ref(null); // { title: string, details?: string, errors?: Array<string|object> }
const isError = ref(false);

async function handleSendPromotion() {
  isSending.value = true;
  responseMessage.value = null;
  isError.value = false;

  try {
    const payload = { ...form.value };
    // Ensure optional fields that are empty are not sent or are sent as null if API expects that
    if (!payload.promoTitle) {
      delete payload.promoTitle; // Or set to null if API prefers: payload.promoTitle = null;
    }

    const result = await $api.post('/admin/marketing/send-promo-email', payload);

    responseMessage.value = {
      title: 'Campaign Initiated Successfully!',
      details: result.data?.message || `Attempted: ${result.data?.details?.totalAttempted}, Succeeded: ${result.data?.details?.successfulSends}, Failed: ${result.data?.details?.failedSends}.`,
    };
    // Optionally reset form
    form.value = { subject: '', promoTitle: '', promoMessageBody: '', ctaLink: '', ctaText: '' };

  } catch (error) {
    isError.value = true;
    console.error('Error sending promotional email:', error.response?.data || error.message);
    if (error.response && error.response.data) {
      if (error.response.status === 400 && error.response.data.errors) { // Validation errors from express-validator
        responseMessage.value = {
          title: 'Validation Error',
          details: 'Please check the form fields.',
          errors: error.response.data.errors.map(e => e.msg), // Assuming express-validator format
        };
      } else {
        responseMessage.value = {
          title: 'Error Sending Email',
          details: error.response.data.message || 'An unexpected error occurred.',
          errors: error.response.data.details?.errors // If backend provides detailed error strings
        };
      }
    } else {
      responseMessage.value = {
        title: 'Network Error',
        details: 'Could not connect to the server. Please try again later.',
      };
    }
  } finally {
    isSending.value = false;
  }
}
</script>

<style scoped>
/* Add any page-specific styles if needed */
</style>
