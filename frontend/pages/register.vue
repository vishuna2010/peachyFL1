<template>
  <div class="auth-page">
    <h2>Register</h2>
    <form @submit.prevent="handleRegister" class="auth-form">
      <div class="form-group">
        <label for="email">Email:</label>
        <input type="email" id="email" v-model="email" required />
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <input type="password" id="password" v-model="password" required />
      </div>
      <div class="form-group">
        <label for="confirmPassword">Confirm Password:</label>
        <input type="password" id="confirmPassword" v-model="confirmPassword" required />
      </div>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      <div v-if="successMessage" class="success-message">{{ successMessage }}</div>
      <button type="submit" :disabled="isLoading">
        {{ isLoading ? 'Registering...' : 'Register' }}
      </button>
    </form>
    <p>
      Already have an account? <NuxtLink to="/login">Login here</NuxtLink>
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
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

<style scoped>
/* Using similar styles to login.vue for consistency */
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
.auth-form input[type="password"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box; /* Ensures padding doesn't expand width */
}
.error-message {
  color: red;
  margin-bottom: 1rem;
  text-align: center;
  background-color: #ffe0e0;
  padding: 0.5rem;
  border-radius: 4px;
}
.success-message {
  color: green;
  margin-bottom: 1rem;
  text-align: center;
  background-color: #e0ffe0;
  padding: 0.5rem;
  border-radius: 4px;
}
button[type="submit"] {
  width: 100%;
  padding: 0.75rem;
  background-color: #28a745; /* Green for register */
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}
button[type="submit"]:disabled {
  background-color: #aaa;
}
button[type="submit"]:hover:not(:disabled) {
  background-color: #1e7e34;
}
p {
  margin-top: 1.5rem;
  text-align: center;
}
</style>
