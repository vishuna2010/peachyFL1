<template>
  <div class="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[calc(100vh-theme(spacing.16))]">
    <h2 class="text-2xl sm:text-3xl font-bold text-text-primary mb-8 text-center">Setup Two-Factor Authentication (2FA)</h2>

    <div v-if="isLoadingInitialData" class="my-6 p-6 bg-neutral-light text-text-secondary rounded-lg shadow text-center">Generating your 2FA setup details...</div>
    <div v-if="pageError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">{{ pageError }}</div>

    <template v-if="setupDataLoaded && !pageError">
      <div class="setup-instructions bg-white p-6 rounded-lg shadow-md border border-neutral-medium mb-6">
        <p class="text-text-secondary leading-relaxed">
          Scan the QR code below with your authenticator app (e.g., Google Authenticator, Authy, Duo).
          If you cannot scan the QR code, you can manually enter the secret key.
        </p>
      </div>

      <div class="qr-code-container my-6 p-4 bg-white inline-block rounded-lg shadow-md border border-neutral-medium mx-auto" v-if="qrCodeDataUrl">
        <img :src="qrCodeDataUrl" alt="2FA QR Code" class="max-w-[200px] sm:max-w-[250px] mx-auto" />
      </div>

      <div class="secret-key-container my-6 p-4 bg-neutral-light rounded-lg shadow flex justify-between items-center border border-neutral-medium">
        <p class="text-text-primary"><strong class="font-medium">Secret Key:</strong> <span class="font-mono text-brand-primary break-all">{{ secret }}</span></p>
        <button
          @click="copySecret"
          class="ml-4 px-3 py-1.5 text-sm bg-brand-primary text-white rounded-md hover:bg-opacity-80 transition-colors duration-150 shadow-sm"
        >
          {{ copyButtonText }}
        </button>
      </div>

      <div class="verification-form mt-8 pt-6 border-t border-neutral-dark">
        <h3 class="text-xl font-semibold text-text-primary mb-2 text-center">Verify Code & Enable 2FA</h3>
        <p class="text-sm text-text-secondary mb-4 text-center">Enter the 6-digit code from your authenticator app.</p>
        <form @submit.prevent="handleVerifyAndEnable" class="space-y-4 max-w-xs mx-auto">
          <div class="form-group">
            <label for="verificationCode" class="block text-sm font-medium text-text-primary sr-only">Verification Code:</label>
            <input
              type="text"
              id="verificationCode"
              v-model="verificationCode"
              placeholder="123456"
              required
              pattern="\d{6}"
              title="Enter a 6-digit code"
              class="w-full px-4 py-3 border border-neutral-dark rounded-lg text-center text-lg tracking-[0.2em] shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:bg-neutral-light"
              :disabled="isVerifying"
            />
          </div>

          <div v-if="verificationError" class="p-3 text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg">{{ verificationError }}</div>
          <div v-if="verificationSuccess" class="p-3 text-sm text-green-700 bg-green-100 border border-green-200 rounded-lg">{{ verificationSuccess }}</div>

          <button
            type="submit"
            :disabled="isVerifying || !verificationCode || verificationCode.length !== 6"
            class="w-full px-6 py-3 bg-brand-primary text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-60 transition-colors duration-150"
          >
            {{ isVerifying ? 'Verifying...' : 'Verify & Enable 2FA' }}
          </button>
        </form>
      </div>
    </template>
     <div v-if="!isLoadingInitialData && !setupDataLoaded && !pageError" class="my-6 p-6 bg-neutral-light text-text-secondary rounded-lg shadow text-center">
        <p class="mb-3">Could not load 2FA setup data. Please try again or contact support.</p>
        <NuxtLink to="/profile" class="mt-4 inline-block px-5 py-2.5 border border-neutral-dark text-text-primary bg-white hover:bg-neutral-light rounded-md shadow-sm text-sm font-medium transition-colors duration-150">Back to Profile</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useNuxtApp, useRouter, useRoute } from '#app';
import { useAuth } from '~/composables/useAuth';
import QRCode from 'qrcode';

definePageMeta({
  layout: 'default',
  middleware: async (to, from) => {
    const { authToken, isAuthInitialized } = useAuth();

    if (typeof isAuthInitialized !== 'undefined' && !isAuthInitialized.value) {
      await new Promise(resolve => {
        const unwatch = watch(isAuthInitialized, (newValue) => {
          if (newValue) {
            unwatch();
            resolve();
          }
        });
      });
    }

    if (!authToken.value) {
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  }
});

const { $axios } = useNuxtApp();
const router = useRouter();

const secret = ref('');
const otpAuthUrl = ref('');
const qrCodeDataUrl = ref('');
const verificationCode = ref('');

const isLoadingInitialData = ref(true);
const setupDataLoaded = ref(false);
const pageError = ref('');

const isVerifying = ref(false);
const verificationError = ref('');
const verificationSuccess = ref('');
const copyButtonText = ref('Copy Secret');


async function fetch2FASetupData() {
  isLoadingInitialData.value = true;
  pageError.value = '';
  try {
    const response = await $axios.post('/auth/2fa/setup');
    if (response.data.success) {
      secret.value = response.data.secret;
      otpAuthUrl.value = response.data.otpAuthUrl;
      if (otpAuthUrl.value) {
        qrCodeDataUrl.value = await QRCode.toDataURL(otpAuthUrl.value);
      }
      setupDataLoaded.value = true;
    } else {
      pageError.value = response.data.message || 'Failed to retrieve 2FA setup details.';
    }
  } catch (error) {
    console.error('Error fetching 2FA setup data:', error);
    pageError.value = error.response?.data?.message || 'An error occurred while starting 2FA setup.';
     if (error.response?.status === 400 && error.response?.data?.message.includes('2FA is already enabled')) {
    }
  } finally {
    isLoadingInitialData.value = false;
  }
}

async function copySecret() {
    if (secret.value && navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(secret.value);
            copyButtonText.value = 'Copied!';
            setTimeout(() => { copyButtonText.value = 'Copy Secret'; }, 2000);
        } catch (err) {
            console.error('Failed to copy secret: ', err);
            alert('Failed to copy secret. Please copy it manually.');
        }
    } else {
        alert('Clipboard API not available. Please copy the secret manually.');
    }
}

async function handleVerifyAndEnable() {
  verificationError.value = '';
  verificationSuccess.value = '';

  if (!verificationCode.value || !/^\d{6}$/.test(verificationCode.value)) {
    verificationError.value = 'Please enter a valid 6-digit verification code.';
    return;
  }
  if (!secret.value) {
    verificationError.value = 'Secret key is missing. Please try reloading the setup.';
    return;
  }

  isVerifying.value = true;
  try {
    const response = await $axios.post('/auth/2fa/verify', {
      token: verificationCode.value,
      secret: secret.value,
    });

    if (response.data.success) {
      verificationSuccess.value = response.data.message || '2FA enabled successfully!';
      secret.value = '********';
      otpAuthUrl.value = '';
      qrCodeDataUrl.value = '';
      setupDataLoaded.value = false;
      alert('2FA enabled successfully! You might be redirected or your profile page will update.');
      router.push('/profile');
    } else {
      verificationError.value = response.data.message || 'Failed to verify code.';
    }
  } catch (error) {
    console.error('Error verifying 2FA code:', error);
    verificationError.value = error.response?.data?.message || 'An error occurred during verification.';
  } finally {
    isVerifying.value = false;
  }
}

onMounted(() => {
  fetch2FASetupData();
});

useHead({
  title: 'Setup 2FA',
});
</script>
