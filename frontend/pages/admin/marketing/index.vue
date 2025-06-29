<template>
  <div class="container mx-auto p-6">
    <div class="bg-white shadow-xl rounded-lg p-8">
      <h1 class="text-3xl font-bold text-gray-800 mb-8">Send Promotional Email</h1>

      <form @submit.prevent="handleSendPromotion">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label for="subject" class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input type="text" v-model="form.subject" id="subject" required class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
          </div>
          <div>
            <label for="promoTitle" class="block text-sm font-medium text-gray-700 mb-1">Promotional Title (Optional)</label>
            <input type="text" v-model="form.promoTitle" id="promoTitle" class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
          </div>
        </div>

        <div class="mb-6">
          <label for="promoMessageBody" class="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
          <textarea v-model="form.promoMessageBody" id="promoMessageBody" rows="6" required class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label for="ctaLink" class="block text-sm font-medium text-gray-700 mb-1">CTA Link (Full URL)</label>
            <input type="url" v-model="form.ctaLink" id="ctaLink" required class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="https://example.com/promotion">
          </div>
          <div>
            <label for="ctaText" class="block text-sm font-medium text-gray-700 mb-1">CTA Button Text</label>
            <input type="text" v-model="form.ctaText" id="ctaText" required class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Shop Now!">
          </div>
        </div>

        <div class="flex items-center justify-end space-x-4">
          <button
            type="submit"
            :disabled="isSending"
            class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <svg v-if="isSending" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isSending ? 'Sending...' : 'Send Promotional Email' }}
          </button>
        </div>
      </form>

      <!-- Response Message Display -->
      <div v-if="responseMessage" :class="['mt-6 p-4 rounded-md border', isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700']">
        <h3 class="text-lg font-semibold mb-2">{{ responseMessage.title }}</h3>
        <p v-if="responseMessage.details" class="text-sm">{{ responseMessage.details }}</p>
        <ul v-if="responseMessage.errors && responseMessage.errors.length > 0" class="list-disc list-inside mt-2 text-sm">
          <li v-for="(err, index) in responseMessage.errors" :key="index">{{ typeof err === 'object' ? err.msg : err }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'admin',
  // middleware: ['admin-auth', 'rbac'], // Removed as per fix for users page
  // requiredPermission: 'marketing:send_emails' // RBAC middleware handles this globally
});

useHead({
  title: 'Marketing Campaigns - Admin',
});

import { ref } from 'vue';
import { useNuxtApp } from '#app'; // Correct import for useNuxtApp

const { $axios } = useNuxtApp(); // Assuming $axios is configured

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
    if (!payload.promoTitle) {
      // Keep promoTitle in payload, even if empty, if API handles it.
      // If API expects it to be absent if empty, use: delete payload.promoTitle;
      // Or set to null: payload.promoTitle = null;
    }

    // Ensure $axios is used, not $api if it was a typo
    const result = await $axios.post('/admin/marketing/send-promo-email', payload);

    responseMessage.value = {
      title: 'Campaign Initiated Successfully!',
      details: result.data?.message || `Attempted: ${result.data?.details?.totalAttempted}, Succeeded: ${result.data?.details?.successfulSends}, Failed: ${result.data?.details?.failedSends}.`,
    };
    form.value = { subject: '', promoTitle: '', promoMessageBody: '', ctaLink: '', ctaText: '' };

  } catch (error) {
    isError.value = true;
    console.error('Error sending promotional email:', error.response?.data || error.message);
    if (error.response && error.response.data) {
      if (error.response.status === 400 && error.response.data.errors) {
        responseMessage.value = {
          title: 'Validation Error',
          details: 'Please check the form fields.',
          errors: error.response.data.errors.map(e => e.msg),
        };
      } else {
        responseMessage.value = {
          title: 'Error Sending Email',
          details: error.response.data.message || 'An unexpected error occurred.',
          errors: error.response.data.details?.errors
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
