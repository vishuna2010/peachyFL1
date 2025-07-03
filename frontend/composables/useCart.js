import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuth } from '~/composables/useAuth'; // Import useAuth to get user ID

// Cart item structure (persisted in localStorage)
// {
//   cartItemId: 'variant-VID' or 'product-PID',
//   productId: 'PID', // Base Product ID
//   variantId: 'VID', // or null
//   name: 'Product Name (with variant info)',
//   quantity: 1,
//   price: 29.99, // Unit price (pre-tax)
//   image_url: 'path/to/image.jpg',
//   sku: 'SKU-123',
//   type: 'variant' or 'product',
//   tax_class_id: 'TCID1', // Stored at time of adding to cart
//   tax_class_name: 'Standard Rate', // Stored at time of adding to cart
// }
const cartItems = ref([]);
const isCartInitialized = ref(false);
const CART_STORAGE_KEY = 'myNuxtEcommerceCart';

// For discount state (remains global to this composable instance)
const appliedDiscount = ref(null);
const discountValidationError = ref('');

// New state for tax calculation results
const cartTaxDetails = ref(null); // Will store { line_items_with_tax_details, total_tax_amount, tax_summary_details }
const isFetchingTaxDetails = ref(false);
const taxCalculationError = ref('');


// --- Persistence ---
const saveCartToLocalStorage = () => {
  if (process.client) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems.value));
  }
};

const loadCartFromLocalStorage = () => {
  // This function is synchronous and directly manipulates cartItems.value
  // It's called by initCart, which handles the isCartInitialized flag.
  if (process.client) {
    console.log('useCart: Attempting to load cart from localStorage...');
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (storedCart) {
      try {
        const parsedCart = JSON.parse(storedCart);
        if (Array.isArray(parsedCart)) {
          cartItems.value = parsedCart;
          console.log(`useCart: Cart loaded from localStorage. ${cartItems.value.length} items.`);
        } else {
          console.warn('useCart: Stored cart data is not an array, resetting cart.');
          cartItems.value = [];
          localStorage.removeItem(CART_STORAGE_KEY);
        }
      } catch (error) {
        console.error('useCart: Error parsing cart from localStorage, resetting cart.', error);
        cartItems.value = [];
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } else {
      console.log('useCart: No cart data found in localStorage.');
      cartItems.value = []; // Ensure cartItems is an empty array if nothing is stored
    }
  }
};

// This function is outside 'export const useCart' because appliedDiscount is also global here.
// If these were part of the returned object from useCart, this wouldn't be necessary.
function clearAppliedDiscountGlobal() {
    appliedDiscount.value = null;
    discountValidationError.value = '';
}

export const useCart = () => {
  const { $axios } = useNuxtApp();
  const toast = useToast();
  const { authUser, isAuthenticated } = useAuth(); // Get user details

  // --- Tax Calculation Function ---
  const fetchCartTaxDetails = async (currentCartItems, currentUserId, shippingAddressForTax = null) => {
    if (!currentCartItems || currentCartItems.length === 0) {
      cartTaxDetails.value = null; // Clear tax details if cart is empty
      taxCalculationError.value = '';
      return;
    }
    isFetchingTaxDetails.value = true;
    taxCalculationError.value = '';
    try {
      // Prepare payload for the backend, filtering out invalid items
      const itemsToTax = currentCartItems
        .filter(item => {
          const isValidProductId = typeof item.productId === 'number' && item.productId > 0;
          const isValidQuantity = typeof item.quantity === 'number' && item.quantity > 0;
          // Price can be 0, so check if it's a number and non-negative
          const isValidPrice = typeof item.price === 'number' && !isNaN(item.price) && item.price >= 0;

          if (!isValidProductId || !isValidQuantity || !isValidPrice) {
            console.warn('Filtering out invalid cart item for tax calculation:', JSON.parse(JSON.stringify(item)));
          }
          return isValidProductId && isValidQuantity && isValidPrice;
        })
        .map(item => {
          const mappedItem = {
            productId: item.productId,
            quantity: item.quantity,
            price: parseFloat(item.price.toFixed(2)) // Ensure price is correctly formatted float
          };
          // Only include variantId if it's a positive integer
          if (typeof item.variantId === 'number' && item.variantId > 0) {
            mappedItem.variantId = item.variantId;
          }
          return mappedItem;
        }); // Corrected: removed extra parenthesis

      // If, after filtering, itemsToTax is empty but the original cart was not, it means all items were invalid.
      if (itemsToTax.length === 0 && currentCartItems.length > 0) {
        console.warn('All cart items were invalid for tax calculation. Not calling API.');
        cartTaxDetails.value = null;
        taxCalculationError.value = 'No valid items in cart to calculate tax for.';
        isFetchingTaxDetails.value = false;
        return;
      }
      // If itemsToTax is empty because currentCartItems was initially empty, the top-level check handles it.
      if (itemsToTax.length === 0) {
        // This path is taken if currentCartItems was empty initially or all items filtered out
        // and the previous block already handled the "all items filtered out" case.
        // So, if currentCartItems was empty, this is the correct state.
        cartTaxDetails.value = null;
        taxCalculationError.value = '';
        isFetchingTaxDetails.value = false;
        return;
      }

      const payload = {
        cartItems: itemsToTax, // Use the filtered and mapped items
      };
      // Conditionally add userId only if it's a positive integer
      if (currentUserId && Number.isInteger(currentUserId) && currentUserId > 0) {
        payload.userId = currentUserId;
      }


      // If guest user (currentUserId is null or not valid), add a placeholder shipping address
      // The backend requires a country for tax calculation for guests.
      if (!currentUserId) {
        payload.shippingAddress = shippingAddressForTax || {
          country: 'US', // Default placeholder country
          // state_province_region: null, // Optional based on backend needs
          // postalCode: null // Optional
        };
        console.log('Guest user detected for tax calculation. Shipping address being used:', JSON.stringify(payload.shippingAddress));
      } else if (shippingAddressForTax) {
        // If logged-in user AND a specific address is provided for estimation (e.g. from checkout page)
        payload.shippingAddress = shippingAddressForTax;
         console.log('Logged-in user, explicit shippingAddress provided for tax calculation:', JSON.stringify(payload.shippingAddress));
      }
      // If logged-in user and no shippingAddressForTax is provided, the backend will use the user's default.

      console.log('Attempting to fetch tax details with payload:', JSON.stringify(payload, null, 2));
      const response = await $axios.post('/cart/calculate-taxes', payload);
      cartTaxDetails.value = response.data;
      console.log('Tax details fetched successfully:', response.data);
    } catch (error) {
      console.error('Error fetching cart tax details. Status:', error.response?.status, 'Data:', error.response?.data, 'Full Error:', error);
      // Log the specific first error object if available
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors) && error.response.data.errors.length > 0) {
        console.error('Specific backend validation error for tax calculation:', error.response.data.errors[0]);
      } else {
        console.error('Detailed tax calculation error data from backend (no specific errors array found):', error.response?.data);
      }
      const message = error.response?.data?.message || 'Failed to calculate taxes.';
      taxCalculationError.value = message;
      // toast.error(message); // Optionally show toast, or let UI handle taxCalculationError
      cartTaxDetails.value = null; // Clear previous tax details on error
    } finally {
      isFetchingTaxDetails.value = false;
    }
  };


  // --- Cart Initialization ---
  const initCart = async () => { // Made async to await fetchCartTaxDetails
    if (process.client && !isCartInitialized.value) {
      console.log('useCart: Starting cart initialization...');
      loadCartFromLocalStorage(); // Synchronously loads cart items

      // Set isCartInitialized to true only AFTER cartItems are loaded
      isCartInitialized.value = true;
      console.log('useCart: Cart populated from localStorage. isCartInitialized set to true. Items count:', cartItems.value.length);

      // Fetch tax details once cart is loaded and initialized, if items exist
      if (cartItems.value.length > 0) {
        console.log('useCart: Cart has items, fetching tax details...');
        // Ensure auth state is ready for user ID, or pass null
        let userIdForTax = null;
        if (isAuthenticated && typeof isAuthenticated.value === 'boolean' && isAuthenticated.value) {
            if (authUser && typeof authUser.value === 'object' && authUser.value !== null && typeof authUser.value.id !== 'undefined') {
                userIdForTax = authUser.value.id;
            }
        }
        await fetchCartTaxDetails(cartItems.value, userIdForTax);
      } else {
        console.log('useCart: Cart is empty after initialization, no tax details to fetch.');
        cartTaxDetails.value = null; // Ensure tax details are cleared if cart is empty
        taxCalculationError.value = '';
      }
    } else if (process.client && isCartInitialized.value) {
      console.log('useCart: Cart initialization already completed.');
    }
  };

  // Ensure initCart is called when the composable is first used client-side
  // This needs to be handled carefully as composable setup is sync.
  // The onMounted hook is appropriate for client-side specific async initialization.
  if (process.client) {
      onMounted(async () => { // Make onMounted async to await initCart
        if (!isCartInitialized.value) { // Double check, initCart also checks
          await initCart();
        }
      });
  }


  // --- Cart Item Management ---
  const addToCart = (itemDetails, quantityToAdd = 1) => {
    if (!itemDetails || !itemDetails.id) {
      console.error('Invalid itemDetails passed to addToCart', itemDetails);
      toast.error("Could not add item to cart: Invalid product data.");
      return;
    }
    if (!isCartInitialized.value && process.client) initCart();

    const cartItemId = itemDetails.type === 'variant'
      ? `variant-${itemDetails.variant_id}`
      : `product-${itemDetails.product_id}`;
    const existingItem = cartItems.value.find(item => item.cartItemId === cartItemId);

    if (existingItem) {
      existingItem.quantity += quantityToAdd;
      toast.info(`Quantity of "${existingItem.name}" updated to ${existingItem.quantity}.`);
    } else {
      const priceAsFloat = parseFloat(itemDetails.price);
      const newItem = {
        cartItemId,
        id: itemDetails.id,
        productId: itemDetails.product_id,
        variantId: itemDetails.variant_id || null,
        name: itemDetails.name,
        price: isNaN(priceAsFloat) ? 0 : priceAsFloat, // Ensure price is a number, default to 0
        image_url: itemDetails.image_url || null,
        sku: itemDetails.sku || null,
        type: itemDetails.type,
        tax_class_id: itemDetails.tax_class_id || null,
        tax_class_name: itemDetails.tax_class_name || null,
        quantity: quantityToAdd,
      };
      cartItems.value.push(newItem);
      toast.success(`"${newItem.name}" (Qty: ${quantityToAdd}) added to cart!`);
    }
  };

  const removeFromCart = (cartItemIdToRemove) => {
    if (!isCartInitialized.value && process.client) initCart();
    const itemIndex = cartItems.value.findIndex(item => item.cartItemId === cartItemIdToRemove);
    if (itemIndex > -1) {
      const removedItemName = cartItems.value[itemIndex].name;
      cartItems.value.splice(itemIndex, 1);
      toast.info(`"${removedItemName}" removed from cart.`);
    }
  };

  const updateQuantity = (cartItemIdToUpdate, newQuantity) => {
    if (!isCartInitialized.value && process.client) initCart();
    const item = cartItems.value.find(item => item.cartItemId === cartItemIdToUpdate);
    if (item) {
      if (newQuantity <= 0) {
        removeFromCart(cartItemIdToUpdate);
      } else {
        item.quantity = newQuantity;
        toast.info(`Quantity of "${item.name}" updated to ${newQuantity}.`);
      }
    }
  };

  const clearCart = () => {
    cartItems.value = [];
    clearAppliedDiscount(); // This will also trigger tax recalc via watch
    cartTaxDetails.value = null; // Explicitly clear tax details
    taxCalculationError.value = '';
    toast.info("Cart cleared.");
  };

  // --- Discount Management ---
  async function applyDiscountCode(codeToApply) {
    if (!codeToApply || codeToApply.trim() === '') {
      discountValidationError.value = 'Please enter a discount code.';
      appliedDiscount.value = null;
      toast.error('Please enter a discount code.');
      return;
    }
    discountValidationError.value = '';
    // appliedDiscount.value = null; // Clearing here might cause a flicker if validation fails but a previous discount was valid

    const subtotal = cartSubtotal.value; // Tax is usually applied on pre-discount subtotal

    try {
      const response = await $axios.post('/cart/validate-discount', {
        discount_code: codeToApply.trim().toUpperCase(),
        cart_subtotal: subtotal // Send current cart subtotal for validation
      });
      appliedDiscount.value = response.data; // Store the whole discount object
      toast.success(`Discount "${response.data.code}" applied!`);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Invalid or expired discount code.';
      discountValidationError.value = errorMessage;
      appliedDiscount.value = null; // Clear discount on error
      toast.error(errorMessage);
    }
  }

  function clearAppliedDiscount() {
    if(appliedDiscount.value) {
        toast.info(`Discount "${appliedDiscount.value.code}" removed.`);
    }
    appliedDiscount.value = null;
    discountValidationError.value = '';
    // Tax recalculation will be handled by the watcher on cartItems/appliedDiscount
  }


  // --- Computed Properties ---
  const cartSubtotal = computed(() => {
    const sub = cartItems.value.reduce((total, item) => {
      const itemPrice = typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0;
      const itemQuantity = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 0;
      return total + (itemPrice * itemQuantity);
    }, 0);
    return parseFloat(sub.toFixed(2));
  });

  const cartTotalTax = computed(() => {
    return parseFloat(cartTaxDetails.value?.total_tax_amount || 0).toFixed(2);
  });

  const cartLineItemsWithTaxDetails = computed(() => {
    return cartTaxDetails.value?.line_items_with_tax_details || [];
  });

  const calculatedDiscountAmount = computed(() => {
    if (appliedDiscount.value && appliedDiscount.value.calculated_discount_amount_for_cart) {
        return parseFloat(appliedDiscount.value.calculated_discount_amount_for_cart);
    }
    return 0;
  });

  const cartFinalTotalPrice = computed(() => {
    const subtotalAfterDiscount = cartSubtotal.value - calculatedDiscountAmount.value;
    const totalWithTax = subtotalAfterDiscount + parseFloat(cartTotalTax.value);
    return parseFloat(Math.max(0, totalWithTax).toFixed(2));
  });

  const cartTotalItems = computed(() => {
    return cartItems.value.reduce((total, item) => total + item.quantity, 0);
  });

  // --- Watchers ---
  // Watch for changes in cart items to save to localStorage and refetch tax details
  watch(cartItems, (newCartItems, oldCartItems) => {
    if (isCartInitialized.value) {
      saveCartToLocalStorage();

      // Defensively get user ID for tax calculation
      let userIdForTax = null;
      if (isAuthenticated && typeof isAuthenticated.value === 'boolean' && isAuthenticated.value) {
        if (authUser && typeof authUser.value === 'object' && authUser.value !== null && typeof authUser.value.id !== 'undefined') {
          userIdForTax = authUser.value.id;
        }
      }
      fetchCartTaxDetails(newCartItems, userIdForTax);

      if (newCartItems.length === 0) {
        clearAppliedDiscountGlobal(); // Clears discount if cart becomes empty
      }
    }
  }, { deep: true });

  // Watch for changes in applied discount to refetch tax details
  // (though current backend tax logic is on pre-discount price, this is good practice if tax rules change)
  // This might be redundant if fetchCartTaxDetails is already called by cartItems watcher which implicitly covers discount changes affecting final price.
  // However, if discount application itself needs to trigger a specific type of tax re-evaluation (e.g. tax on discounted amount), this would be useful.
  // For now, the main trigger is cartItems change.
  // watch(appliedDiscount, () => {
  //   if (isCartInitialized.value && cartItems.value.length > 0) {
  //     fetchCartTaxDetails(cartItems.value, isAuthenticated.value ? authUser.value?.id : null);
  //   }
  // });


  return {
    // State
    cartItems: computed(() => cartItems.value),
    isCartInitialized: computed(() => isCartInitialized.value),
    appliedDiscount: computed(() => appliedDiscount.value),
    discountValidationError: computed(() => discountValidationError.value),
    cartTaxDetails: computed(() => cartTaxDetails.value),
    isFetchingTaxDetails: computed(() => isFetchingTaxDetails.value),
    taxCalculationError: computed(() => taxCalculationError.value),

    // Actions
    initCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    applyDiscountCode,
    clearAppliedDiscount,
    fetchCartTaxDetails, // Expose if manual refresh is needed from UI

    // Computed Getters
    cartTotalItems,
    cartSubtotal,
    cartTotalTax,
    cartLineItemsWithTaxDetails, // Expose for itemized tax display
    cartFinalTotalPrice,
    calculatedDiscountAmount: calculatedDiscountAmount, // Expose calculated discount amount
  };
};
