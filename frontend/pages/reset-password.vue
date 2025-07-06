<template>
  <div class="min-h-screen bg-neutral-bg-soft flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img class="mx-auto h-16 w-auto" src="/Logo.svg" alt="Site Logo" />
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Reset your password
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Enter your new password below.
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10">
        <div v-if="isLoadingInitial" class="text-center py-10">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          <p class="mt-2 text-sm text-gray-500">Validating reset link...</p>
        </div>

        <div v-else-if="tokenError" class="text-center py-10">
          <div class="text-red-500 mb-4">
            <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Invalid or Expired Link</h3>
          <p class="text-gray-600 mb-6">{{ tokenError }}</p>
          <NuxtLink
            to="/forgot-password"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink"
          >
            Request New Reset Link
          </NuxtLink>
        </div>

        <form v-else @submit.prevent="handleResetPassword" class="space-y-6">
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <div class="mt-1">
              <input 
                id="password" 
                v-model="password" 
                name="password" 
                type="password" 
                autocomplete="new-password" 
                required
                :disabled="isLoading"
                :class="[
                  'appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm disabled:opacity-70',
                  errorMessage && errorMessage.includes('password') ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-peach-pink focus:border-peach-pink'
                ]"
                @input="errorMessage = ''"
              />
            </div>
            <p class="mt-1 text-xs text-gray-500">Password must be at least 6 characters long</p>
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <div class="mt-1">
              <input 
                id="confirmPassword" 
                v-model="confirmPassword" 
                name="confirmPassword" 
                type="password" 
                autocomplete="new-password" 
                required
                :disabled="isLoading"
                :class="[
                  'appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm disabled:opacity-70',
                  errorMessage && errorMessage.includes('match') ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-peach-pink focus:border-peach-pink'
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
              {{ isLoading ? 'Resetting Password...' : 'Reset Password' }}
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
import { ref, onMounted } from 'vue';
import { useRoute, useRouter, useHead } from '#app';
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const password = ref('');
const confirmPassword = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);
const isLoadingInitial = ref(true);
const tokenError = ref('');

const resetToken = ref('');

onMounted(() => {
  // Get token from URL query parameter
  resetToken.value = route.query.token;
  
  if (!resetToken.value) {
    tokenError.value = 'No reset token provided. Please request a new password reset link.';
    isLoadingInitial.value = false;
    return;
  }
  
  // Token is present, allow form to be shown
  isLoadingInitial.value = false;
});

const handleResetPassword = async () => {
  // Clear previous messages
  errorMessage.value = '';
  successMessage.value = '';

  // Client-side validation
  if (!password.value || password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters long.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
    return;
  }

  isLoading.value = true;

  try {
    const response = await $axios.post('/auth/reset-password', {
      token: resetToken.value,
      newPassword: password.value
    });
    
    if (response.status === 200) {
      successMessage.value = response.data.message || 'Password has been reset successfully!';
      // Clear form
      password.value = '';
      confirmPassword.value = '';
      toast.success('Password reset successfully!');
      
      // Redirect to login page after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } else {
      errorMessage.value = response.data.message || 'Failed to reset password. Please try again.';
    }
  } catch (error) {
    if (error.response) {
      errorMessage.value = error.response.data?.message || 'Failed to reset password. Please try again.';
    } else {
      errorMessage.value = 'Network error. Please check your connection and try again.';
    }
  } finally {
    isLoading.value = false;
  }
};

useHead({
  title: 'Reset Password',
});
</script> 