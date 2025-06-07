import { ref, computed, watch } from 'vue';

// Cart item structure: { productId: string, quantity: number, name: string, price: number, image_url: string | null }
const cartItems = ref([]);
const isCartInitialized = ref(false); // To prevent multiple initializations

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

  const addToCart = (product, quantity = 1) => {
    if (!product || !product.id) {
      console.error('Invalid product passed to addToCart');
      return;
    }
    if (!isCartInitialized.value && process.client) {
        initCart(); // Ensure cart is loaded before operations
    }

    const existingItem = cartItems.value.find(item => item.productId === product.id);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cartItems.value.push({
        productId: product.id,
        name: product.name,
        price: parseFloat(product.price), // Ensure price is a number
        image_url: product.image_url || null,
        quantity: quantity,
      });
    }
    // saveCartToLocalStorage(); // Watcher handles this
    console.log('Added to cart:', product.name, 'Quantity:', quantity);
  };

  const removeFromCart = (productId) => {
     if (!isCartInitialized.value && process.client) {
        initCart();
    }
    cartItems.value = cartItems.value.filter(item => item.productId !== productId);
    // saveCartToLocalStorage(); // Watcher handles this
    console.log('Removed from cart, productId:', productId);
  };

  const updateQuantity = (productId, quantity) => {
    if (!isCartInitialized.value && process.client) {
        initCart();
    }
    const item = cartItems.value.find(item => item.productId === productId);
    if (item) {
      if (quantity <= 0) {
        removeFromCart(productId);
      } else {
        item.quantity = quantity;
      }
    }
    // saveCartToLocalStorage(); // Watcher handles this
    console.log('Updated quantity for productId:', productId, 'New Quantity:', quantity);
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
