<template>
  <nav v-if="breadcrumbs.length > 0" class="mb-4 px-4 sm:px-6 lg:px-8 py-2.5 border-b border-gray-200 bg-white shadow-sm" aria-label="Breadcrumb">
    <ol class="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
      <li class="inline-flex items-center">
        <NuxtLink to="/admin" class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-indigo-600">
          <svg class="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
            <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/>
          </svg>
          Admin
        </NuxtLink>
      </li>
      <li v-for="(crumb, index) in breadcrumbs" :key="index" aria-current="page">
        <div class="flex items-center">
          <svg class="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4"/>
          </svg>
          <NuxtLink
            v-if="index < breadcrumbs.length - 1"
            :to="crumb.path"
            class="ms-1 text-sm font-medium text-gray-700 hover:text-indigo-600 md:ms-2"
          >
            {{ crumb.name }}
          </NuxtLink>
          <span v-else class="ms-1 text-sm font-medium text-gray-500 md:ms-2">
            {{ crumb.name }}
          </span>
        </div>
      </li>
    </ol>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from '#app';

const route = useRoute();

const breadcrumbs = computed(() => {
  const pathArray = route.path.split('/').filter(p => p);
  const crumbs = [];

  // Ensure "Admin" is not the first generated crumb if already handled by the static link
  if (pathArray[0] === 'admin') {
    pathArray.shift(); // Remove 'admin' as it's the base
  }

  let currentPath = '/admin'; // Start with admin base path

  pathArray.forEach((segment, index) => {
    currentPath += `/${segment}`;

    // Capitalize and improve segment name
    let name = segment
      .replace(/\[id\]/g, route.params.id || 'detail') // Prioritize [id] specifically
      .replace(/\[(.*?)\]/g, (match, p1) => route.params[p1] || p1) // General param replacement
      .replace(/-/g, ' ') // Replace hyphens with spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Specific overrides for better names
    if (name.toLowerCase() === 'classes' && crumbs.length > 0 && crumbs[crumbs.length-1].name.toLowerCase().includes('tax')) {
        name = 'Classes';
    } else if (name.toLowerCase() === 'rates' && crumbs.length > 0 && crumbs[crumbs.length-1].name.toLowerCase().includes('tax')) {
        name = 'Rates';
    } else if (name.toLowerCase() === 'logs' && crumbs.length > 0 && crumbs[crumbs.length-1].name.toLowerCase().includes('inventory')) {
        name = 'Movement Logs';
    }


    // Handle dynamic segments like [id] or [paramName]
    if (segment.match(/^\[.*\]$/) && index > 0) {
        const prevSegmentName = crumbs[crumbs.length-1]?.name || pathArray[index-1];
        let detailName = prevSegmentName;
        // Try to make it singular, e.g. "Users" -> "User Detail" or "User [ID]"
        if (prevSegmentName.endsWith('s')) {
            detailName = prevSegmentName.slice(0, -1);
        }
        // If the current segment was [id] and we have an ID, show it. Otherwise, "Detail".
        if (segment === '[id]' && route.params.id) {
            name = `${detailName} #${route.params.id}`;
        } else {
            name = `${detailName} Detail`;
        }
    }


    crumbs.push({
      name: name,
      path: currentPath
    });
  });
  return crumbs;
});
</script>
