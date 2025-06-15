import { shallowMount, flushPromises } from '@vue/test-utils';
import ReviewsIndex from '../index.vue'; // Adjust path as needed

// Mock NuxtApp and $axios
const mockAxiosGet = vi.fn();
const mockAxiosPut = vi.fn();
const mockAxiosDelete = vi.fn();

vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $axios: {
      get: mockAxiosGet,
      put: mockAxiosPut,
      delete: mockAxiosDelete,
    },
  }),
  definePageMeta: vi.fn(),
  useHead: vi.fn(),
}));

describe('Admin Reviews Page (frontend/pages/admin/reviews/index.vue)', () => {
  let wrapper;

  const mockReviews = [
    { id: 1, product_name: 'Laptop Pro', user_name: 'Alice', rating: 5, comment: 'Excellent!', created_at: new Date().toISOString(), status: 'approved' },
    { id: 2, product_name: 'Coffee Maker', user_name: 'Bob', rating: 3, comment: 'It is okay.', created_at: new Date().toISOString(), status: 'pending' },
  ];

  const mockPagination = {
    currentPage: 1,
    totalPages: 1,
    totalItems: 2,
    limit: 15,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockAxiosGet.mockResolvedValue({
      data: {
        data: mockReviews,
        pagination: mockPagination,
      },
    });
    mockAxiosPut.mockResolvedValue({ data: {} });
    mockAxiosDelete.mockResolvedValue({ data: {} });

    wrapper = shallowMount(ReviewsIndex);
  });

  test('displays loading message initially', () => {
    const loadingWrapper = shallowMount(ReviewsIndex, {
       setup() { // Override setup to control initial state for this specific test
        return {
          isLoading: ref(true),
          reviews: ref([]),
          error: ref(null),
          fetchReviews: vi.fn(),
          // ... other refs and methods
          currentPage: ref(1),
          totalPages: ref(1),
          limit: ref(15),
          selectedStatus: ref('all'),
          statusOptions: ref([
            { value: 'all', text: 'All Statuses' },
            { value: 'pending', text: 'Pending' },
            { value: 'approved', text: 'Approved' },
            { value: 'rejected', text: 'Rejected' },
          ]),
          updateReviewStatus: vi.fn(),
          confirmDeleteReview: vi.fn(),
          nextPage: vi.fn(),
          prevPage: vi.fn(),
          statusBadgeClass: vi.fn(),
        };
      }
    });
    expect(loadingWrapper.text()).toContain('Loading reviews...');
  });

  test('fetches and displays a list of reviews', async () => {
    await flushPromises();
    expect(mockAxiosGet).toHaveBeenCalledWith('/api/admin/reviews', expect.any(Object));
    const reviewRows = wrapper.findAll('tbody tr');
    expect(reviewRows.length).toBe(mockReviews.length);
    expect(wrapper.text()).toContain('Laptop Pro');
    expect(wrapper.text()).toContain('Alice');
    expect(wrapper.text()).toContain('Excellent!');
  });

  test('changing status filter calls fetchReviews with the new status', async () => {
    await flushPromises(); // Initial load

    wrapper.vm.selectedStatus = 'pending'; // Change filter
    await flushPromises(); // Wait for watcher and fetch

    expect(mockAxiosGet).toHaveBeenCalledWith('/api/admin/reviews', expect.objectContaining({
      params: expect.objectContaining({ status: 'pending', page: 1 }), // page resets to 1
    }));
  });

  test('changing review status for an item calls the update API', async () => {
    await flushPromises();
    const firstReview = mockReviews[0];
    const newStatus = 'rejected';

    // Simulate the select change for the first review
    // This is tricky with shallowMount if the select is deep.
    // Direct call to method is more robust for unit testing the logic.
    await wrapper.vm.updateReviewStatus(firstReview.id, newStatus);

    expect(mockAxiosPut).toHaveBeenCalledWith(`/api/admin/reviews/${firstReview.id}/status`, { status: newStatus });
    // Check if review status is updated locally (optimistic update)
    const updatedReview = wrapper.vm.reviews.find(r => r.id === firstReview.id);
    expect(updatedReview.status).toBe(newStatus);
  });

  test('deleting a review calls the delete API after confirmation', async () => {
    await flushPromises();
    window.confirm = vi.fn(() => true); // Mock confirm

    const firstReviewId = mockReviews[0].id;
    await wrapper.vm.confirmDeleteReview(firstReviewId); // Call method that includes confirm

    expect(window.confirm).toHaveBeenCalled();
    expect(mockAxiosDelete).toHaveBeenCalledWith(`/api/admin/reviews/${firstReviewId}`);
    expect(mockAxiosGet).toHaveBeenCalledTimes(2); // Initial fetch + fetch after delete
  });

  test('displays "No reviews found" if API returns empty list', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { data: [], pagination: { totalPages: 0, currentPage: 1 } } });
    wrapper = shallowMount(ReviewsIndex); // Remount with new mock
    await flushPromises();
    expect(wrapper.text()).toContain('No reviews found');
  });

  test('handles API error during fetch', async () => {
    const errorMessage = 'Server Unavailable';
    mockAxiosGet.mockRejectedValueOnce({ message: errorMessage });
    wrapper = shallowMount(ReviewsIndex); // Remount
    await flushPromises();
    expect(wrapper.text()).toContain('Failed to load reviews.');
    // expect(wrapper.text()).toContain(errorMessage); // If error message is directly rendered
  });

  test('pagination buttons call fetchReviews with correct page numbers', async () => {
    mockAxiosGet.mockResolvedValue({data: { data: mockReviews, pagination: { ...mockPagination, totalPages: 3, currentPage: 1 }}});
    wrapper = shallowMount(ReviewsIndex);
    await flushPromises(); // Initial load

    // Click Next
    wrapper.vm.currentPage = 1; // ensure starting at 1
    wrapper.vm.totalPages = 3; // ensure there are multiple pages
    await wrapper.vm.$nextTick(); // allow DOM to update if pagination buttons depend on these values

    const nextButton = wrapper.find('button:contains(Next)');
    await nextButton.trigger('click');
    // `currentPage` itself is watched, so fetchReviews is called by the watcher.
    // We need to check if `currentPage` was incremented and then if fetchReviews was called.
    expect(wrapper.vm.currentPage).toBe(2);
    expect(mockAxiosGet).toHaveBeenLastCalledWith('/api/admin/reviews', expect.objectContaining({
        params: expect.objectContaining({ page: 2 })
    }));

    // Click Previous
    await wrapper.vm.prevPage(); // Call method directly for simplicity
    expect(wrapper.vm.currentPage).toBe(1);
     expect(mockAxiosGet).toHaveBeenLastCalledWith('/api/admin/reviews', expect.objectContaining({
        params: expect.objectContaining({ page: 1 })
    }));
  });

});
