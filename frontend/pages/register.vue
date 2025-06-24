<template>
  <div class="min-h-screen bg-neutral-bg-soft flex flex-col justify-center py-12 sm:px-6 lg:px-8"> <!-- Changed background -->
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img class="mx-auto h-16 w-auto" src="/logo.png" alt="Site Logo" /> <!-- Updated logo, adjusted size -->
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
              <input id="email" v-model="email" name="email" type="email" autocomplete="email" required
                     :disabled="isLoading"
                     class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm disabled:opacity-70" />
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div class="mt-1">
              <input id="password" v-model="password" name="password" type="password" autocomplete="new-password" required
                     :disabled="isLoading"
                     class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm disabled:opacity-70" />
            </div>
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <div class="mt-1">
              <input id="confirmPassword" v-model="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required
                     :disabled="isLoading"
                     class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm disabled:opacity-70" />
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
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
    return;
  }
  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  const result = await register(email.value, password.value);
  isLoading.value = false;

  if (result.success) {
    successMessage.value = result.message || 'Registration successful! Please login.';
    // Optionally redirect to login page after a short delay
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  } else {
    errorMessage.value = result.message || 'Failed to register. Please try again.';
  }
};

useHead({
  title: 'Register',
});
</script>

<!-- No <style scoped> block needed with Tailwind CSS -->
