<template>
  <div :class="bannerClasses" class="py-3 px-4 text-center">
    <p class="font-semibold" v-if="title">{{ title }}</p>
    <p :class="subtitle ? 'mt-1' : ''">{{ mainText }}
      <NuxtLink v-if="linkText && linkUrl" :to="linkUrl" class="underline font-bold hover:opacity-80 transition-opacity duration-200">
        {{ linkText }}
      </NuxtLink>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' }, // Added subtitle prop
  mainText: { type: String, required: true },
  linkText: { type: String, default: '' },
  linkUrl: { type: String, default: '#' },
  type: { type: String, default: 'primary' } // 'primary', 'secondary'
});

const bannerClasses = computed(() => {
  let classes = 'text-sm ';
  if (props.type === 'primary') {
    // Use fresh-green for primary promotional banners
    classes += 'bg-fresh-green text-white';
  } else if (props.type === 'secondary') {
    // Use sky-blue for secondary promotional banners
    classes += 'bg-sky-blue text-white';
  } else {
    // Default to a neutral or less prominent style if type is not recognized
    classes += 'bg-venus-neutral-light text-venus-text-primary';
  }
  return classes;
});
</script>
