<template>
  <div class="min-h-screen bg-neutral-bg-soft flex flex-col justify-center py-12 sm:px-6 lg:px-8"> <!-- Changed background -->
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img class="mx-auto h-16 w-auto" src="/Logo.svg" alt="Site Logo" /> <!-- Corrected to Logo.svg -->
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Create your account
      </h2>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10">
        <form @submit.prevent="handleRegister" class="space-y-6">
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

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">
              Password
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
              Confirm Password
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
          <div v-if="successMessage" class="p-3 text-sm text-fresh-green bg-fresh-green/10 rounded-md border border-fresh-green/20 text-center"> <!-- Themed success -->
            {{ successMessage }}
          </div>

          <div>
            <button type="submit" :disabled="isLoading"
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-70 disabled:cursor-not-allowed">
              {{ isLoading ? 'Registering...' : 'Register' }}
            </button>
          </div>
        </form>

        <p class="mt-8 text-center text-sm text-gray-600">
          Already have an account?
          <NuxtLink to="/login" class="font-medium text-peach-pink hover:text-opacity-80 hover:underline">
            Sign in
          </NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useHead } from '#app'; // Added useHead
import { useAuth } from '~/composables/useAuth';

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);

const { register } = useAuth();
const router = useRouter();

const handleRegister = async () => {
  // Clear previous messages
  errorMessage.value = '';
  successMessage.value = '';

  // Client-side validation
  if (!email.value || !email.value.trim()) {
    errorMessage.value = 'Email is required.';
    return;
  }

  if (!password.value || password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters long.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
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
    const result = await register(email.value, password.value);
    
    if (result.success) {
      successMessage.value = result.message || 'Registration successful! Please check your email to verify your account.';
      // Clear form
      email.value = '';
      password.value = '';
      confirmPassword.value = '';
      // Redirect to login page after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } else {
      errorMessage.value = result.message || 'Failed to register. Please try again.';
    }
  } catch (error) {
    console.error('Registration error:', error);
    errorMessage.value = 'An unexpected error occurred. Please try again.';
  } finally {
    isLoading.value = false;
  }
};

useHead({
  title: 'Register',
});
</script>

<!-- No <style scoped> block needed with Tailwind CSS -->
