<template>
  <div class="min-h-screen bg-neutral-bg-soft flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img class="mx-auto h-16 w-auto" src="/Logo.svg" alt="Site Logo" />
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Forgot your password?
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Enter your email address and we'll send you a link to reset your password.
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10">
        <form @submit.prevent="handleRequestReset" class="space-y-6">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div class="mt-1">
              <input 
                id="email" 
                v-model="email" 
                name="email" 
                type="email" 
                autocomplete="email" 
                required
                :disabled="isLoading"
                :class="[
                  'appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm disabled:opacity-70',
                  errorMessage && errorMessage.includes('email') ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-peach-pink focus:border-peach-pink'
                ]"
                @input="errorMessage = ''"
              />
            </div>
          </div>

          <div v-if="errorMessage" class="p-3 text-sm text-red-700 bg-red-100 rounded-md border border-red-200 text-center">
            {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="p-3 text-sm text-fresh-green bg-fresh-green/10 rounded-md border border-fresh-green/20 text-center">
            {{ successMessage }}
          </div>

          <div>
            <button 
              type="submit" 
              :disabled="isLoading"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {{ isLoading ? 'Sending...' : 'Send Reset Link' }}
            </button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            Remember your password?
            <NuxtLink to="/login" class="font-medium text-peach-pink hover:text-opacity-80 hover:underline">
              Sign in
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useHead } from '#app';
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';

const { $axios } = useNuxtApp();
const router = useRouter();
const toast = useToast();

const email = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);

const handleRequestReset = async () => {
  // Clear previous messages
  errorMessage.value = '';
  successMessage.value = '';

  // Client-side validation
  if (!email.value || !email.value.trim()) {
    errorMessage.value = 'Email is required.';
    return;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value)) {
    errorMessage.value = 'Please enter a valid email address.';
    return;
  }

  isLoading.value = true;

  try {
    const response = await $axios.post('/auth/request-password-reset', { email: email.value });
    
    if (response.status === 200) {
      successMessage.value = response.data.message || 'Password reset instructions have been sent to your email.';
      // Clear form
      email.value = '';
      toast.success('Password reset email sent successfully!');
    } else {
      errorMessage.value = response.data.message || 'Failed to send reset instructions. Please try again.';
    }
  } catch (error) {
    if (error.response) {
      errorMessage.value = error.response.data?.message || 'Failed to send reset instructions. Please try again.';
    } else {
      errorMessage.value = 'Network error. Please check your connection and try again.';
    }
  } finally {
    isLoading.value = false;
  }
};

useHead({
  title: 'Forgot Password',
});
</script> 