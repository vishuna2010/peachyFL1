<template>
  <div class="auth-page">
    <h2>Login</h2>
    <form @submit.prevent="isTwoFactorStep ? handleTwoFactorVerify() : handleLogin()" class="auth-form">
      <template v-if="!isTwoFactorStep">
        <div class="form-group">
          <label for="email">Email:</label>
          <input type="email" id="email" v-model="email" required :disabled="isLoading" />
        </div>
        <div class="form-group">
          <label for="password">Password:</label>
          <input type="password" id="password" v-model="password" required :disabled="isLoading" />
        </div>
      </template>
      <template v-else>
        <p class="info-message">A verification code has been sent to your authenticator app. Please enter it below.</p>
        <div class="form-group">
          <label for="twoFactorToken">2FA Verification Code:</label>
          <input type="text" id="twoFactorToken" v-model="twoFactorToken" required pattern="\d{6}" title="Enter a 6-digit code" :disabled="isLoading" />
        </div>
      </template>

      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

      <button type="submit" :disabled="isLoading" class="submit-button">
        <span v-if="isLoading">{{ isLoadingText }}</span>
        <span v-else>{{ isTwoFactorStep ? 'Verify Code' : 'Login' }}</span>
      </button>

      <button type="button" v-if="isTwoFactorStep" @click="cancelTwoFactor" :disabled="isLoading" class="cancel-button">
        Cancel / Try Password Again
      </button>
    </form>
    <p v-if="!isTwoFactorStep">
      Don't have an account? <NuxtLink to="/register">Register here</NuxtLink>
    </p>
    <p v-if="!isTwoFactorStep">
      <NuxtLink to="/auth/request-password-reset-page">Forgot Password?</NuxtLink> <!-- Assuming such a page exists or will -->
    </p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute, useNuxtApp } from '#app';
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

<style scoped>
.auth-page {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}
h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}
.auth-form .form-group {
  margin-bottom: 1rem;
}
.auth-form label {
  display: block;
  margin-bottom: 0.5rem;
  color: #555;
}
.auth-form input[type="email"],
.auth-form input[type="password"],
.auth-form input[type="text"] { /* For 2FA token */
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}
.auth-form input:disabled {
    background-color: #e9ecef;
}
.error-message {
  color: red;
  margin-bottom: 1rem;
  text-align: center;
  background-color: #ffe0e0;
  padding: 0.5rem;
  border-radius: 4px;
}
.info-message {
  color: #0056b3;
  background-color: #e7f3ff;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  text-align: center;
  font-size: 0.9em;
}
.submit-button {
  width: 100%;
  padding: 0.75rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  margin-bottom: 0.5rem; /* Space for cancel button */
}
.submit-button:disabled {
  background-color: #aaa;
}
.submit-button:hover:not(:disabled) {
  background-color: #0056b3;
}
.cancel-button {
  width: 100%;
  padding: 0.6rem;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}
.cancel-button:disabled {
    background-color: #aaa;
}
.cancel-button:hover:not(:disabled) {
    background-color: #545b62;
}
p {
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9em;
}
</style>
