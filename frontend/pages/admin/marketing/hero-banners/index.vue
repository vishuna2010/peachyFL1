<template>
  <div>
    <Breadcrumbs :items="breadcrumbs" />
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Manage Hero Banners</h1>
      <NuxtLink
        to="/admin/marketing/hero-banners/new"
        class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors duration-150"
      >
        Create New Banner
      </NuxtLink>
    </div>
    <!-- Placeholder for banner list table -->
    <p class="mt-4 text-gray-600">Banner list and management table will appear here.</p>
    <p class="mt-2 text-sm text-gray-500">This section will allow viewing, editing, deleting, and reordering of hero banners.</p>
  </div>
</template>

<script setup>
import Breadcrumbs from '~/components/admin/Breadcrumbs.vue';

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'rbac'],
  permission: 'marketing:manage_hero_banners'
});

useHead({ title: 'Manage Hero Banners' });

const breadcrumbs = [
  { text: 'Admin', href: '/admin' },
  { text: 'Marketing', href: '/admin/marketing' },
  { text: 'Hero Banners' }
];
</script>
