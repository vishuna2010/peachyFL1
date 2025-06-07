import { ref, computed, watch } from 'vue';

// Cart item structure:
// {
//   cartItemId: 'prod123-variant456', // or 'prod123-base'
//   productId: '123', // Base Product ID
//   productVariantId: '456', // or null
//   name: 'Awesome T-Shirt', // Base Product Name
//   quantity: 1,
//   price: 29.99, // Final price of this item (variant or base)
//   image_url: 'path/to/variant_or_base_image.jpg',
//   sku: 'SKU-RED-L', // Variant or base SKU
//   selectedVariantDescription: 'Color: Red, Size: Large' // or empty string/null
// }
const cartItems = ref([]);
const isCartInitialized = ref(false);

const CART_STORAGE_KEY = 'myNuxtEcommerceCart';

// --- Persistence ---
const saveCartToLocalStorage = () => {
  if (process.client) { // Ensure localStorage is only accessed on the client
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems.value));
  }
};

const loadCartFromLocalStorage = () => {
  if (process.client) {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (storedCart) {
      cartItems.value = JSON.parse(storedCart);
    }
  }
};

// Watch for changes in cartItems and save to localStorage
// This needs to be outside the useCart function if cartItems is truly global singleton shared across useCart calls
// However, Nuxt composables usually return their own state unless explicitly shared via useState
// For this example, we'll make cartItems a global singleton for simplicity of this file.
// A more robust approach for multiple instances might involve Nuxt's useState for global reactive state.

// --- Reactive State ---
// These are effectively singletons due to Nuxt's module caching if not using useState explicitly.
const appliedDiscount = ref(null); // Stores validated discount object from backend
const discountValidationError = ref('');

// Watch for changes in cartItems and save to localStorage
watch(cartItems, (newCart) => {
  if (isCartInitialized.value) {
    saveCartToLocalStorage();
    // If cart changes, re-evaluate discount applicability (e.g., min purchase amount)
    // For simplicity, we might require users to re-apply discount if cart changes significantly.
    // Or, the backend validation during order placement will be the final check.
    // For now, let's clear discount if cart becomes empty, as min_order_amount might no longer be met.
    if (newCart.length === 0) {
        clearAppliedDiscount();
    }
  }
}, { deep: true });

// Also watch appliedDiscount to save/load from localStorage if desired (more complex UX)
// For now, appliedDiscount is session-only and not persisted in localStorage with the cart.


export const useCart = () => {
  const { $axios } = useNuxtApp(); // For API calls

  const initCart = () => {
    if (process.client && !isCartInitialized.value) {
      loadCartFromLocalStorage();
      // Note: appliedDiscount is not loaded from localStorage here to keep it simple.
      // It resets on page load/refresh. User would need to re-apply.
      isCartInitialized.value = true;
      console.log('Cart initialized from localStorage.');
    }
  };

  // productDetails should contain:
  // id (base productId), productVariantId (optional), name (base name),
  // price (final price), image_url (final image), sku (final sku),
  // stock_quantity (available stock of item being added - for reference, not stored directly in cart item),
  // selectedOptionsDescriptionArray (e.g., ["Color: Red", "Size: M"])
  const addToCart = (productDetails, quantity = 1) => {
    if (!productDetails || !productDetails.id) {
      console.error('Invalid productDetails passed to addToCart');
      return;
    }
    if (!isCartInitialized.value && process.client) {
        initCart();
    }

    const cartItemId = productDetails.id + '-' + (productDetails.productVariantId || 'base');
    const existingItem = cartItems.value.find(item => item.cartItemId === cartItemId);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      const selectedVariantDesc = productDetails.selectedOptionsDescriptionArray
                                  ? productDetails.selectedOptionsDescriptionArray.join(', ')
                                  : '';
      cartItems.value.push({
        cartItemId: cartItemId,
        productId: productDetails.id,
        productVariantId: productDetails.productVariantId || null,
        name: productDetails.name, // Base product name
        price: parseFloat(productDetails.price), // Final price for this item
        image_url: productDetails.image_url || null,
        sku: productDetails.sku || null,
        selectedVariantDescription: selectedVariantDesc,
        quantity: quantity,
      });
    }
    console.log('Added to cart:', productDetails.name, 'Variant:', productDetails.productVariantId, 'Quantity:', quantity);
  };

  const removeFromCart = (cartItemIdToRemove) => {
     if (!isCartInitialized.value && process.client) {
        initCart();
    }
    cartItems.value = cartItems.value.filter(item => item.cartItemId !== cartItemIdToRemove);
    console.log('Removed from cart, cartItemId:', cartItemIdToRemove);
  };

  const updateQuantity = (cartItemIdToUpdate, newQuantity) => {
    if (!isCartInitialized.value && process.client) {
        initCart();
    }
    const item = cartItems.value.find(item => item.cartItemId === cartItemIdToUpdate);
    if (item) {
      if (newQuantity <= 0) {
        removeFromCart(cartItemIdToUpdate); // Use the specific item's cartId
      } else {
        item.quantity = newQuantity;
      }
    }
    console.log('Updated quantity for cartItemId:', cartItemIdToUpdate, 'New Quantity:', newQuantity);
  };

  const clearCart = () => {
    cartItems.value = [];
    clearAppliedDiscount(); // Also clear discount when cart is cleared
    console.log('Cart cleared.');
  };

  // --- Discount Functions ---
  async function applyDiscountCode(codeToApply) {
    if (!codeToApply || codeToApply.trim() === '') {
      discountValidationError.value = 'Please enter a discount code.';
      appliedDiscount.value = null;
      return;
    }
    discountValidationError.value = '';
    appliedDiscount.value = null;

    // Calculate current subtotal to send for validation
    const subtotal = cartTotalPrice.value; // This is subtotal before any discount

    try {
      // This backend endpoint `/api/cart/validate-discount` needs to be created.
      // It should validate the code against the cart subtotal and return discount details.
      const response = await $axios.post('/cart/validate-discount', {
        discount_code: codeToApply.trim().toUpperCase(),
        cart_subtotal: subtotal
      });

      // Assuming backend returns something like:
      // { code, type, value, description, calculated_discount_amount_for_cart, message (optional) }
      appliedDiscount.value = response.data;
      console.log('Discount applied:', response.data);
    } catch (error) {
      console.error('Error applying discount code:', error.response?.data?.message || error.message);
      discountValidationError.value = error.response?.data?.message || 'Invalid or expired discount code.';
      appliedDiscount.value = null;
    }
  }

  function clearAppliedDiscount() {
    appliedDiscount.value = null;
    discountValidationError.value = '';
    console.log('Applied discount cleared.');
  }

  // --- Computed Properties ---
  const cartSubtotal = computed(() => { // Renamed cartTotalPrice to cartSubtotal for clarity
    if (!isCartInitialized.value && process.client && cartItems.value.length > 0) {
        // Attempt to initialize if not done and items are present (e.g. direct navigation to cart)
        // initCart(); // This might cause issues if called mid-computation. Better to ensure initCart runs early.
    }
    const total = cartItems.value.reduce((total, item) => total + (item.price * item.quantity), 0);
    return parseFloat(total.toFixed(2));
  });

  const cartFinalTotalPrice = computed(() => {
    if (appliedDiscount.value && appliedDiscount.value.calculated_discount_amount_for_cart) {
      const finalTotal = cartSubtotal.value - parseFloat(appliedDiscount.value.calculated_discount_amount_for_cart);
      return parseFloat(Math.max(0, finalTotal).toFixed(2)); // Ensure total isn't negative
    }
    return cartSubtotal.value;
  });

  const cartTotalItems = computed(() => {
    return cartItems.value.reduce((total, item) => total + item.quantity, 0);
  });


  return {
    cartItems: computed(() => cartItems.value),
    isCartInitialized: computed(() => isCartInitialized.value),
    appliedDiscount: computed(() => appliedDiscount.value),
    discountValidationError: computed(() => discountValidationError.value),
    initCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    applyDiscountCode,
    clearAppliedDiscount,
    cartTotalItems,
    cartSubtotal, // Expose subtotal
    cartFinalTotalPrice, // Expose final total
  };
};
