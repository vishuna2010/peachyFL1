<template>
  <footer class="bg-peach-pink text-white py-12">
    <div class="container mx-auto px-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
        <div>
          <h5 class="font-bold font-serif text-lg mb-3">Shop</h5> {/* text-white is inherited */}
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Tops</a></li>
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Dresses</a></li>
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Swim</a></li>
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Sale</a></li>
          </ul>
        </div>
        <div>
          <h5 class="font-bold font-serif text-lg mb-3">Help</h5> {/* text-white is inherited */}
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">FAQs</a></li>
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Contact Us</a></li>
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Size Info</a></li>
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Shipping & Returns</a></li>
          </ul>
        </div>
        <div>
          <h5 class="font-bold font-serif text-lg mb-3">About Us</h5> {/* text-white is inherited */}
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Our Story</a></li>
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Careers</a></li>
            <li><a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Blog</a></li>
          </ul>
        </div>
        <div>
          <h5 class="font-bold font-serif text-lg mb-3">Stay Connected</h5> {/* text-white is inherited */}
          <p class="text-sm">Sign up for email & SMS to unlock 15% off!</p>
          <div class="flex space-x-3 mt-4">
            <a href="#" aria-label="Instagram" class="hover:text-lemon-yellow transition-colors duration-200 ease-in-out"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.013 3.584-.07 4.85c-.053 1.17-.249 1.805-.413 2.227-.217.562-.477.96-.896 1.382-.42.419-.819.679-1.381.896-.422.164-1.057.36-2.227.413-1.266.057-1.646.07-4.85.07s-3.584-.013-4.85-.07c-1.17-.053-1.805-.249-2.227-.413-.562-.217-.96-.477-1.382-.896-.419-.42-.679-.819-.896-1.381-.164-.422-.36-1.057-.413-2.227-.057-1.266-.07-1.646-.07-4.85s.013-3.584.07-4.85c.053-1.17.249 1.805.413 2.227.217.562.477.96.896 1.382.42.419.819.679 1.381.896.422.164 1.057.36 2.227.413 1.266.057 1.646.07 4.85.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.28.058-2.148.272-2.914.578a4.913 4.913 0 00-1.771 1.153 4.913 4.913 0 00-1.153 1.771c-.305.766-.52 1.634-.578 2.914-.058 1.28-.072 1.688-.072 4.947s.014 3.667.072 4.947c.058 1.28.272 2.148.578 2.914a4.913 4.913 0 001.153 1.771 4.913 4.913 0 001.771 1.153c.766.305 1.634.52 2.914.578 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.28-.058 2.148-.272 2.914-.578a4.913 4.913 0 001.771-1.153 4.913 4.913 0 001.153-1.771c.305-.766-.52-1.634-.578-2.914.058-1.28.072-1.688-.072-4.947s-.014-3.667-.072-4.947c-.058-1.28-.272-2.148-.578-2.914a4.913 4.913 0 00-1.153-1.771 4.913 4.913 0 00-1.771-1.153c-.766-.305-1.634-.52-2.914-.578C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a3.999 3.999 0 110-7.999 3.999 3.999 0 010 7.999zm6.406-11.845a1.44 1.44 0 100-2.88 1.44 1.44 0 000 2.88z"></path></svg></a>
            <!-- Add other social icons similarly -->
          </div>
        </div>
      </div>
      <div class="text-center text-sm border-t border-white border-opacity-30 pt-6"> {/* text-white is inherited, border adjusted for peach-pink bg */}
        <p>&copy; ${new Date().getFullYear()} YOUR_COMPANY_NAME. All rights reserved.</p>
        <p class="mt-1">
          <a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Privacy Policy</a> |
          <a href="#" class="hover:text-lemon-yellow hover:underline transition-colors duration-200 ease-in-out">Terms & Conditions</a>
        </p>
      </div>
    </div>
  </footer>
</template>
<script setup>
// No script needed for this simple version
</script>
