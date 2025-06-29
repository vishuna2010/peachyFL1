<template>
  <div>
    <h1>Marketing Page Test</h1>
    <p>If you see this, basic routing to /admin/marketing/index.vue is working.</p>
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

const { $axios } = useNuxtApp(); // Assuming $axios is configured, or use $api if that's the convention

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
-->

<style scoped>
/* Add any page-specific styles if needed */
</style>
