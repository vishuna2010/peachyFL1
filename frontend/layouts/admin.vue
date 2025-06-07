<template>
  <div class="admin-layout">
    <header class="admin-header">
      <h1>Admin Panel</h1>
      <nav>
        <ul>
          <li><NuxtLink to="/">Site Home</NuxtLink></li>
          <li><NuxtLink to="/admin/users">User Management</NuxtLink></li>
          <li><NuxtLink to="/admin/orders">Order Management</NuxtLink></li>
          <li><NuxtLink to="/admin/discounts">Discount Codes</NuxtLink></li>
          <li><NuxtLink to="/admin/suppliers">Supplier Management</NuxtLink></li>
          <!-- Add other admin navigation links here -->
          <li v-if="isAuthenticated">
            <button @click="handleLogout" class="logout-button">Logout ({{ user?.email }})</button>
          </li>
        </ul>
      </nav>
    </header>
    <main class="admin-main">
      <slot /> <!-- Page content will be injected here -->
    </main>
    <footer class="admin-footer">
      <p>&copy; {{ new Date().getFullYear() }} Admin Area</p>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useRouter } from 'vue-router';

const { authToken, authUser, logout } = useAuth();
const router = useRouter();

const isAuthenticated = computed(() => !!authToken.value);
const user = computed(() => authUser.value);

const handleLogout = () => {
  logout(); // This should redirect to login as per useAuth composable
};
</script>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f4f7f6; /* Light gray background for admin area */
}

.admin-header {
  background-color: #343a40; /* Dark background for admin header */
  color: white;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.admin-header nav ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.admin-header nav a, .admin-header .logout-button {
  color: #cfd2d6; /* Lighter text color for dark background */
  text-decoration: none;
  padding: 0.5rem;
  border-radius: 4px;
}

.admin-header nav a:hover, .admin-header .logout-button:hover {
  color: #fff;
  background-color: #495057; /* Slightly lighter dark for hover */
}

.logout-button {
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
}

.admin-main {
  flex-grow: 1;
  padding: 1.5rem;
}

.admin-footer {
  text-align: center;
  padding: 1rem;
  background-color: #e9ecef; /* Light background for footer */
  border-top: 1px solid #dee2e6;
  color: #6c757d;
}
</style>
