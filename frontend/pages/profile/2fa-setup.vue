<template>
  <div class="two-fa-setup-page">
    <h2>Setup Two-Factor Authentication (2FA)</h2>

    <div v-if="isLoadingInitialData" class="loading-message">Generating your 2FA setup details...</div>
    <div v-if="pageError" class="error-message page-error">{{ pageError }}</div>

    <template v-if="setupDataLoaded && !pageError">
      <div class="setup-instructions">
        <p>
          Scan the QR code below with your authenticator app (e.g., Google Authenticator, Authy, Duo).
          If you cannot scan the QR code, you can manually enter the secret key.
        </p>
      </div>

      <div class="qr-code-container" v-if="qrCodeDataUrl">
        <img :src="qrCodeDataUrl" alt="2FA QR Code" />
      </div>

      <div class="secret-key-container">
        <p><strong>Secret Key:</strong> <span class="secret-key">{{ secret }}</span></p>
        <button @click="copySecret" class="copy-button">
          {{ copyButtonText }}
        </button>
      </div>

      <div class="verification-form">
        <h3>Verify Code & Enable 2FA</h3>
        <p>Enter the 6-digit code from your authenticator app.</p>
        <form @submit.prevent="handleVerifyAndEnable">
          <div class="form-group">
            <label for="verificationCode">Verification Code:</label>
            <input
              type="text"
              id="verificationCode"
              v-model="verificationCode"
              placeholder="e.g., 123456"
              required
              pattern="\d{6}"
              title="Enter a 6-digit code"
              class="verification-input"
              :disabled="isVerifying"
            />
          </div>

          <div v-if="verificationError" class="error-message">{{ verificationError }}</div>
          <div v-if="verificationSuccess" class="success-message">{{ verificationSuccess }}</div>

          <button type="submit" :disabled="isVerifying || !verificationCode" class="verify-button">
            {{ isVerifying ? 'Verifying...' : 'Verify & Enable 2FA' }}
          </button>
        </form>
      </div>
    </template>
     <div v-if="!isLoadingInitialData && !setupDataLoaded && !pageError">
        <p>Could not load 2FA setup data. Please try again or contact support.</p>
        <NuxtLink to="/profile">Back to Profile</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useNuxtApp, useRouter, useRoute } from '#app';
import { useAuth } from '~/composables/useAuth';
import QRCode from 'qrcode';

definePageMeta({
  layout: 'default', // Or a 'profile' or 'settings' layout if you have one
  // Middleware for auth check. Assuming a generic auth middleware or handled by global one.
  // If not, add a local middleware or check in onMounted.
  middleware: async (to, from) => {
    // This is a basic inline auth check. A named middleware is cleaner.
    const { authToken, isAuthInitialized } = useAuth(); // Assuming isAuthInitialized is available

    // Wait for auth to initialize if it has such a mechanism
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
// const route = useRoute(); // If needed for query params, etc.

const secret = ref('');
const otpAuthUrl = ref('');
const qrCodeDataUrl = ref('');
const verificationCode = ref('');

const isLoadingInitialData = ref(true);
const setupDataLoaded = ref(false);
const pageError = ref(''); // For errors during initial setup call

const isVerifying = ref(false);
const verificationError = ref('');
const verificationSuccess = ref('');
const copyButtonText = ref('Copy Secret');


async function fetch2FASetupData() {
  isLoadingInitialData.value = true;
  pageError.value = '';
  try {
    const response = await $axios.post('/auth/2fa/setup'); // POST as it might create a temporary state or log attempt
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
        // Optionally redirect or show specific UI if 2FA already enabled
        // For now, just showing the error message.
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
    // This backend endpoint /api/auth/2fa/verify needs to be created in the next backend step.
    const response = await $axios.post('/auth/2fa/verify', {
      token: verificationCode.value,
      secret: secret.value, // Send the original raw secret back
    });

    if (response.data.success) {
      verificationSuccess.value = response.data.message || '2FA enabled successfully!';
      // Clear sensitive data from view
      secret.value = '********';
      otpAuthUrl.value = '';
      qrCodeDataUrl.value = ''; // Clear QR code
      setupDataLoaded.value = false; // To hide setup elements
      // Update user state in useAuth composable (e.g., user.is_two_fa_enabled = true)
      // This might involve calling a fetchUser() or similar in useAuth.
      // For now, just show success message. User might be redirected or state updated globally.
      alert('2FA enabled successfully! You might be redirected or your profile page will update.');
      router.push('/profile'); // Or to a settings page
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

<style scoped>
.two-fa-setup-page {
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}
.loading-message, .page-error {
  text-align: center;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}
.loading-message { background-color: #e9ecef; color: #495057; }
.page-error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;}

.setup-instructions {
  margin-bottom: 1.5rem;
  line-height: 1.6;
  color: #555;
}
.qr-code-container {
  text-align: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  border: 1px solid #eee;
  display: inline-block; /* To center the img block */
  border-radius: 4px;
}
.qr-code-container img {
  display: block;
  max-width: 200px; /* Adjust as needed */
  margin: 0 auto;
}
.secret-key-container {
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.secret-key {
  font-family: monospace;
  font-size: 1.1em;
  color: #c7254e; /* Bootstrap's code color */
  word-break: break-all;
}
.copy-button {
  padding: 0.4rem 0.8rem;
  font-size: 0.85em;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.copy-button:hover {
  background-color: #0056b3;
}

.verification-form {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #eee;
}
.verification-form h3 {
  margin-bottom: 0.5rem;
  text-align: center;
}
.verification-form p {
  text-align: center;
  margin-bottom: 1rem;
  color: #666;
  font-size: 0.9em;
}
.form-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.form-group label {
  margin-bottom: 0.5rem;
  font-weight: bold;
}
.verification-input {
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1.2em;
  text-align: center;
  letter-spacing: 0.2em; /* Space out digits */
  width: 100%;
  max-width: 200px; /* Control width */
}
.verification-input:disabled {
    background-color: #e9ecef;
}

.error-message, .success-message {
  padding: 0.75rem;
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  border-radius: 4px;
  text-align: center;
  font-size: 0.9em;
}
.error-message { background-color: #f8d7da; color: #721c24; }
.success-message { background-color: #d4edda; color: #155724; }

.verify-button {
  display: block;
  width: 100%;
  max-width: 250px;
  margin: 1rem auto 0 auto;
  padding: 0.75rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
}
.verify-button:disabled {
  background-color: #aaa;
}
.verify-button:hover:not(:disabled) {
  background-color: #218838;
}
</style>
