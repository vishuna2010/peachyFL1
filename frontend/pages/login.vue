<template>
  <div class="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img class="mx-auto h-12 w-auto" src="/logo.svg" alt="Workflow" /> <!-- Placeholder logo, replace with actual if available -->
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        {{ isTwoFactorStep ? 'Enter Verification Code' : 'Sign in to your account' }}
      </h2>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10">
        <form @submit.prevent="isTwoFactorStep ? handleTwoFactorVerify() : handleLogin()" class="space-y-6">
          <template v-if="!isTwoFactorStep">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div class="mt-1">
                <input id="email" v-model="email" name="email" type="email" autocomplete="email" required
                       :disabled="isLoading"
                       class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200" />
              </div>
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div class="mt-1">
                <input id="password" v-model="password" name="password" type="password" autocomplete="current-password" required
                       :disabled="isLoading"
                       class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200" />
              </div>
            </div>
          </template>
          <template v-else>
            <p class="p-3 text-sm text-blue-700 bg-blue-100 rounded-md border border-blue-200 text-center">
              A verification code has been sent to your authenticator app. Please enter it below.
            </p>
            <div>
              <label for="twoFactorToken" class="block text-sm font-medium text-gray-700">
                6-Digit Verification Code
              </label>
              <div class="mt-1">
                <input id="twoFactorToken" v-model="twoFactorToken" name="twoFactorToken" type="text" required
                       pattern="\d{6}" title="Enter a 6-digit code" :disabled="isLoading"
                       class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200" />
              </div>
            </div>
          </template>

          <div v-if="errorMessage" class="p-3 text-sm text-red-700 bg-red-100 rounded-md border border-red-200 text-center">
            {{ errorMessage }}
          </div>

          <div>
            <button type="submit" :disabled="isLoading"
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed">
              <span v-if="isLoading">{{ isLoadingText }}</span>
              <span v-else>{{ isTwoFactorStep ? 'Verify Code' : 'Sign in' }}</span>
            </button>
          </div>

          <div v-if="isTwoFactorStep">
            <button type="button" @click="cancelTwoFactor" :disabled="isLoading"
                    class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed">
              Cancel / Try Password Again
            </button>
          </div>
        </form>

        <div class="mt-6" v-if="!isTwoFactorStep">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">
                Or
              </span>
            </div>
          </div>

          <div class="mt-2 text-center">
             <p class="text-sm text-gray-600">
              Don't have an account?
              <NuxtLink to="/register" class="font-medium text-indigo-600 hover:text-indigo-500 hover:underline">
                Sign up
              </NuxtLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute, useNuxtApp, useHead } from '#app'; // Added useHead
import { useAuth } from '~/composables/useAuth';

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const isLoading = ref(false);

const { loginSuccess } = useAuth(); // Use the new loginSuccess function
const router = useRouter();
const route = useRoute(); // To get redirect query param
const { $axios } = useNuxtApp();

// --- 2FA State ---
const isTwoFactorStep = ref(false);
const userIdFor2FA = ref(null);
const twoFactorToken = ref('');

const isLoadingText = computed(() => isTwoFactorStep.value ? 'Verifying...' : 'Logging in...');

const handleLogin = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await $axios.post('/auth/login', {
      email: email.value,
      password: password.value,
    });

    if (response.data.success) {
      if (response.data.twoFactorRequired) {
        isTwoFactorStep.value = true;
        userIdFor2FA.value = response.data.userId;
        password.value = ''; // Clear password field for security
        errorMessage.value = response.data.message || 'Please enter your 2FA code.'; // Inform user
      } else {
        // Standard login successful (2FA not enabled or already handled)
        if (loginSuccess(response.data)) { // response.data should be { token, user }
          const redirectPath = route.query.redirect || '/profile';
          router.push(redirectPath);
        } else {
            errorMessage.value = 'Login failed: Invalid response data from server.';
        }
      }
    } else {
      // This case might not be hit if backend returns non-200 for login failure
      errorMessage.value = response.data.message || 'Login failed. Please check your credentials.';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorMessage.value = error.response?.data?.message || 'Failed to login. An unexpected error occurred.';
  } finally {
    isLoading.value = false;
  }
};

const handleTwoFactorVerify = async () => {
  if (!twoFactorToken.value || !/^\d{6}$/.test(twoFactorToken.value)) {
    errorMessage.value = 'Please enter a valid 6-digit 2FA code.';
    return;
  }
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await $axios.post('/auth/2fa/login-verify', {
      userId: userIdFor2FA.value,
      token: twoFactorToken.value,
    });

    if (response.data.success && response.data.token) {
      if (loginSuccess(response.data)) { // response.data should be { token, user }
        const redirectPath = route.query.redirect || '/profile';
        router.push(redirectPath);
        // Reset 2FA state
        isTwoFactorStep.value = false;
        userIdFor2FA.value = null;
        twoFactorToken.value = '';
      } else {
         errorMessage.value = '2FA Login failed: Invalid response data from server.';
      }
    } else {
      errorMessage.value = response.data.message || '2FA verification failed.';
    }
  } catch (error) {
    console.error('2FA verification error:', error);
    errorMessage.value = error.response?.data?.message || 'Failed to verify 2FA code.';
  } finally {
    isLoading.value = false;
  }
};

const cancelTwoFactor = () => {
  isTwoFactorStep.value = false;
  userIdFor2FA.value = null;
  twoFactorToken.value = '';
  errorMessage.value = ''; // Clear any 2FA specific errors
  password.value = ''; // Clear password field as user might want to re-enter
};

useHead({
  title: 'Login',
});
</script>

<!--// No <style scoped> block needed with Tailwind CSS -->
