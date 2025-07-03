<template>
  <div>
    <Breadcrumbs :items="breadcrumbs" />
    <h1 class="text-2xl font-bold mb-4">Create New Hero Banner</h1>
    <!-- Placeholder for HeroBannerForm.vue -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <p class="text-gray-600">Banner creation form will be implemented here using a reusable component.</p>
      <p class="mt-2 text-sm text-gray-500">Fields will include: Title, Subtitle, Button Text, Button Link, Image URL/Upload, Alt Text, Active Status, Sort Order.</p>
    </div>
  </div>
</template>

<script setup>
import Breadcrumbs from '~/components/admin/Breadcrumbs.vue';

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'rbac'],
  permission: 'marketing:manage_hero_banners'
});

useHead({ title: 'Create Hero Banner' });

const breadcrumbs = [
  { text: 'Admin', href: '/admin' },
  { text: 'Marketing', href: '/admin/marketing' },
  { text: 'Hero Banners', href: '/admin/marketing/hero-banners' },
  { text: 'Create New' }
];
</script>
