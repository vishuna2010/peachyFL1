<template>
  <div class="admin-users-page">
    <h2>User Management</h2>

    <div v-if="isLoading" class="loading-state">Loading users...</div>
    <div v-if="fetchError" class="error-state">
      Error fetching users: {{ fetchError.message || fetchError }}
    </div>

    <table v-if="users.length > 0 && !isLoading" class="users-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Email</th>
          <th>Role</th>
          <th>Registered At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.id }}</td>
          <td>{{ user.email }}</td>
          <td>
            <select
              v-model="user.role"
              @change="promptRoleChange(user, $event.target.value)"
              :disabled="isCurrentUser(user.id) || actionLoading.userId === user.id"
              class="role-select"
            >
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </td>
          <td>{{ new Date(user.created_at).toLocaleDateString() }}</td>
          <td class="actions-cell">
            <button
              @click="confirmDeleteUser(user)"
              :disabled="isCurrentUser(user.id) || actionLoading.userId === user.id"
              class="delete-button"
            >
              <span v-if="actionLoading.type === 'delete' && actionLoading.userId === user.id">Deleting...</span>
              <span v-else>Delete</span>
            </button>
            <span v-if="actionLoading.type === 'role' && actionLoading.userId === user.id" class="action-loading-spinner">Updating role...</span>
          </td>
        </tr>
      </tbody>
    </table>
     <div v-if="users.length === 0 && !isLoading && !fetchError">
      <p>No users found.</p>
    </div>

    <div v-if="actionError" class="action-error-message">
      {{ actionError }}
    </div>
    <div v-if="actionSuccessMessage" class="action-success-message">
      {{ actionSuccessMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuth } from '~/composables/useAuth';

// This is crucial for Nuxt 3 to assign the layout
definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const { authUser } = useAuth(); // To check current user ID

const users = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

const actionLoading = ref({ userId: null, type: null }); // { userId: number, type: 'role' | 'delete' }
const actionError = ref('');
const actionSuccessMessage = ref('');

const isCurrentUser = (userId) => {
  return authUser.value?.id === userId;
};

async function fetchUsers() {
  isLoading.value = true;
  fetchError.value = null;
  actionError.value = '';
  actionSuccessMessage.value = '';
  try {
    const response = await $axios.get('/admin/users');
    // Store original role for comparison or reset if API call fails for role change
    users.value = response.data.map(u => ({ ...u, originalRole: u.role }));
  } catch (err) {
    console.error('Failed to fetch users:', err);
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

const promptRoleChange = (user, newRole) => {
  if (confirm(`Are you sure you want to change the role of ${user.email} from ${user.originalRole} to ${newRole}?`)) {
    updateUserRole(user, newRole);
  } else {
    // Revert optimistic UI update if user cancels
    user.role = user.originalRole;
  }
};

async function updateUserRole(user, newRole) {
  actionLoading.value = { userId: user.id, type: 'role' };
  actionError.value = '';
  actionSuccessMessage.value = '';
  try {
    await $axios.put(`/admin/users/${user.id}/role`, { role: newRole });
    actionSuccessMessage.value = `Successfully updated role for ${user.email} to ${newRole}.`;
    user.originalRole = newRole; // Update original role on success
    // Optionally re-fetch users or update locally:
    // For now, local update is handled by v-model and originalRole update
  } catch (err) {
    console.error('Failed to update user role:', err);
    actionError.value = `Failed to update role for ${user.email}: ${err.response?.data?.message || err.message}`;
    user.role = user.originalRole; // Revert UI on error
  } finally {
    actionLoading.value = { userId: null, type: null };
    setTimeout(() => { actionError.value = ''; actionSuccessMessage.value = ''; }, 5000);
  }
}

const confirmDeleteUser = (user) => {
  if (confirm(`Are you sure you want to delete user ${user.email} (ID: ${user.id})? This action cannot be undone.`)) {
    deleteUser(user.id);
  }
};

async function deleteUser(userId) {
  actionLoading.value = { userId: userId, type: 'delete' };
  actionError.value = '';
  actionSuccessMessage.value = '';
  try {
    await $axios.delete(`/admin/users/${userId}`);
    actionSuccessMessage.value = `Successfully deleted user ID ${userId}.`;
    users.value = users.value.filter(u => u.id !== userId); // Refresh list locally
  } catch (err) {
    console.error('Failed to delete user:', err);
    actionError.value = `Failed to delete user ID ${userId}: ${err.response?.data?.message || err.message}`;
  } finally {
    actionLoading.value = { userId: null, type: null };
    setTimeout(() => { actionError.value = ''; actionSuccessMessage.value = ''; }, 5000);
  }
}

onMounted(fetchUsers);

useHead({
  title: 'Admin - User Management',
});
</script>

<style scoped>
.admin-users-page {
  padding: 1rem;
}

h2 {
  margin-bottom: 1.5rem;
  color: #333;
}

.loading-state, .error-state, .action-error-message, .action-success-message {
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 5px;
}
.loading-state { background-color: #eef; }
.error-state { background-color: #fdd; color: #900; border: 1px solid #900; }
.action-error-message { background-color: #fdd; color: #900; border: 1px solid #900; margin-top:1rem; }
.action-success-message { background-color: #dfd; color: #070; border: 1px solid #070; margin-top:1rem; }


.users-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.users-table th, .users-table td {
  border: 1px solid #ddd;
  padding: 0.75rem;
  text-align: left;
}

.users-table th {
  background-color: #f2f2f2;
  color: #333;
  font-weight: bold;
}

.users-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.users-table tr:hover {
  background-color: #f1f1f1;
}

.role-select {
  padding: 0.3rem;
  border-radius: 4px;
  border: 1px solid #ccc;
}
.role-select:disabled {
  background-color: #eee;
  opacity: 0.7;
}

.actions-cell {
  white-space: nowrap;
}
.actions-cell button {
  padding: 0.3rem 0.6rem;
  margin-right: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}
.actions-cell button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-button {
  background-color: #dc3545;
  color: white;
  border: none;
}
.delete-button:hover:not(:disabled) {
  background-color: #c82333;
}
.action-loading-spinner {
  font-size: 0.8em;
  color: #555;
}
</style>
