import { shallowMount, flushPromises } from '@vue/test-utils';
import ProductsIndex from '../index.vue'; // Adjust path as needed

// Mock NuxtApp and $axios
const mockAxiosGet = vi.fn();
const mockAxiosDelete = vi.fn();

vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $axios: {
      get: mockAxiosGet,
      delete: mockAxiosDelete,
    },
  }),
  definePageMeta: vi.fn(),
  useHead: vi.fn(),
}));


// Mock NuxtLink for shallow mounting
const NuxtLink = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
};

describe('Admin Products Page (frontend/pages/admin/products/index.vue)', () => {
  let wrapper;

  const mockProducts = [
    { id: 1, name: 'Product A', sku: 'SKU001', category: { name: 'Category X' }, price: 10000, stock_quantity: 50, status: 'active' },
    { id: 2, name: 'Product B', sku: 'SKU002', category: { name: 'Category Y' }, price: 15000, stock_quantity: 0, status: 'draft' },
  ];

  const mockPagination = {
    currentPage: 1,
    totalPages: 2,
    totalItems: 20,
    limit: 10,
  };

  beforeEach(() => {
    vi.resetAllMocks(); // Reset mocks for each test
    mockAxiosGet.mockResolvedValue({
      data: {
        data: mockProducts,
        pagination: mockPagination,
      },
    });
    mockAxiosDelete.mockResolvedValue({}); // Default successful delete

    wrapper = shallowMount(ProductsIndex, {
      global: {
        components: { NuxtLink },
         stubs: { // Stub NuxtLink if it causes issues or for deeper testing
            NuxtLink: true, // or a more complete stub if needed
        }
      },
    });
  });

  test('displays loading message initially', async () => {
    // Need to control the initial isLoading state if fetchProducts is called immediately
    // For this test, let's assume isLoading is true before onMounted completes
    const loadingWrapper = shallowMount(ProductsIndex, {
      global: { components: { NuxtLink }, stubs: { NuxtLink: true }},
      setup() { // Override setup to control initial state for this specific test
        return {
          isLoading: ref(true), // Explicitly set loading to true
          products: ref([]),
          error: ref(null),
          fetchProducts: vi.fn(), // Mock fetchProducts to prevent immediate call
          // ... other refs and methods needed by the template
          searchTerm: ref(''),
          currentPage: ref(1),
          totalPages: ref(1),
          deleteProduct: vi.fn(),
          nextPage: vi.fn(),
          prevPage: vi.fn(),

        };
      }
    });
    expect(loadingWrapper.text()).toContain('Loading products...');
  });

  test('fetches and displays a list of products', async () => {
    await flushPromises(); // Wait for onMounted and fetchProducts to resolve
    expect(mockAxiosGet).toHaveBeenCalledWith('/api/admin/products', expect.any(Object));
    const productRows = wrapper.findAll('tbody tr');
    expect(productRows.length).toBe(mockProducts.length);
    expect(wrapper.text()).toContain('Product A');
    expect(wrapper.text()).toContain('SKU001');
    expect(wrapper.text()).toContain('$100.00'); // Price formatting
  });

  test('displays "No products found" if API returns empty list', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { data: [], pagination: { totalPages: 0, currentPage: 1 } } });
    wrapper = shallowMount(ProductsIndex, { global: { components: { NuxtLink }, stubs: { NuxtLink: true } } });
    await flushPromises();
    expect(wrapper.text()).toContain('No products found.');
  });

  test('handles API error during fetch', async () => {
    const errorMessage = 'Network Error';
    mockAxiosGet.mockRejectedValueOnce({ message: errorMessage });
    wrapper = shallowMount(ProductsIndex, { global: { components: { NuxtLink }, stubs: { NuxtLink: true } } });
    await flushPromises();
    expect(wrapper.text()).toContain('Failed to load products.');
    // console.log(wrapper.html()); // Check if error.value is rendered
    // expect(wrapper.text()).toContain(errorMessage); // This depends on how error is displayed
  });

  test('pagination buttons call fetchProducts with correct page numbers', async () => {
    await flushPromises();
    wrapper.vm.currentPage = 1;
    wrapper.vm.totalPages = 3;

    // Click Next
    const nextButton = wrapper.find('button:contains(Next)');
    if (nextButton.exists() && !nextButton.attributes('disabled')) {
        await nextButton.trigger('click');
    }
    expect(mockAxiosGet).toHaveBeenCalledWith('/api/admin/products', expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }));

    // Click Previous
    wrapper.vm.currentPage = 2; // Manually set for testing prev
    await flushPromises(); // Allow watchers to react if any
    const prevButton = wrapper.find('button:contains(Previous)');
     if (prevButton.exists() && !prevButton.attributes('disabled')) {
        await prevButton.trigger('click');
    }
    expect(mockAxiosGet).toHaveBeenCalledWith('/api/admin/products', expect.objectContaining({ params: expect.objectContaining({ page: 1 }) }));
  });

  test('search input triggers fetchProducts with search term', async () => {
    await flushPromises();
    const searchInput = wrapper.find('input[type="text"]');
    await searchInput.setValue('TestSearch');
    const searchButton = wrapper.find('button:contains(Search)');
    await searchButton.trigger('click');

    expect(mockAxiosGet).toHaveBeenCalledWith('/api/admin/products', expect.objectContaining({
      params: expect.objectContaining({ search_term: 'TestSearch', page: 1 }),
    }));
  });

  test('delete button calls deleteProduct and refreshes list', async () => {
    await flushPromises();
    window.confirm = vi.fn(() => true); // Mock confirm dialog

    const firstDeleteButton = wrapper.find('tbody tr:first-child button:contains(Delete)');
    await firstDeleteButton.trigger('click');

    expect(window.confirm).toHaveBeenCalled();
    expect(mockAxiosDelete).toHaveBeenCalledWith(`/api/admin/products/${mockProducts[0].id}`);
    // Expect fetchProducts to be called again (it's called after successful delete)
    expect(mockAxiosGet).toHaveBeenCalledTimes(2); // Initial fetch + fetch after delete
  });
});
