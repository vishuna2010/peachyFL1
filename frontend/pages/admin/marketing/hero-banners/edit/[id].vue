<template>
  <div>
    <Breadcrumbs :items="breadcrumbs" />
    <h1 class="text-2xl font-bold mb-4">Edit Hero Banner #{{ bannerId }}</h1>
    <!-- Placeholder for HeroBannerForm.vue -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <p class="text-gray-600">Banner edit form for banner ID <strong class="font-mono">{{ bannerId }}</strong> will be implemented here.</p>
      <p class="mt-2 text-sm text-gray-500">It will fetch existing banner data and populate the form fields.</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Breadcrumbs from '~/components/admin/Breadcrumbs.vue';

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'rbac'],
  permission: 'marketing:manage_hero_banners'
});

const route = useRoute();
const bannerId = computed(() => route.params.id);

useHead({ title: `Edit Hero Banner ${bannerId.value}` });

const breadcrumbs = computed(() => [
  { text: 'Admin', href: '/admin' },
  { text: 'Marketing', href: '/admin/marketing' },
  { text: 'Hero Banners', href: '/admin/marketing/hero-banners' },
  { text: `Edit Banner #${bannerId.value}` }
]);
</script>
