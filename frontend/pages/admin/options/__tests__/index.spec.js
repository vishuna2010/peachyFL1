import { shallowMount, flushPromises } from '@vue/test-utils';
import OptionsIndex from '../index.vue'; // Adjust path as needed

// Mock NuxtApp and $axios
const mockAxiosGet = vi.fn();
const mockAxiosPost = vi.fn();
const mockAxiosPut = vi.fn();
const mockAxiosDelete = vi.fn();

vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $axios: {
      get: mockAxiosGet,
      post: mockAxiosPost,
      put: mockAxiosPut,
      delete: mockAxiosDelete,
    },
  }),
  definePageMeta: vi.fn(),
  useHead: vi.fn(),
}));

describe('Admin Options Page (frontend/pages/admin/options/index.vue)', () => {
  let wrapper;

  const mockOptionTypes = [
    { id: 1, name: 'Color' },
    { id: 2, name: 'Size' },
  ];
  const mockValuesForColor = [
    { id: 10, value: 'Red', option_type_id: 1 },
    { id: 11, value: 'Blue', option_type_id: 1 },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    mockAxiosGet.mockImplementation((url) => {
      if (url === '/api/admin/options') {
        return Promise.resolve({ data: { data: mockOptionTypes } });
      }
      if (url.includes('/values')) { // e.g. /api/admin/options/1/values
        return Promise.resolve({ data: { data: mockValuesForColor } });
      }
      return Promise.reject(new Error(`Unknown GET path: ${url}`));
    });
    mockAxiosPost.mockResolvedValue({ data: {} });
    mockAxiosPut.mockResolvedValue({ data: {} });
    mockAxiosDelete.mockResolvedValue({ data: {} });

    wrapper = shallowMount(OptionsIndex);
  });

  test('displays loading message for option types initially', () => {
     const loadingWrapper = shallowMount(OptionsIndex, {
      setup() {
        return {
          isLoading: ref(true),
          optionTypes: ref([]),
          error: ref(null),
          fetchOptionTypes: vi.fn(),
          // ... other refs and methods
          showAddEditOptionTypeModal: ref(false),
          currentOptionType: ref({ id: null, name: ''}),
          isEditingOptionType: ref(false),
          showManageValuesModal: ref(false),
          selectedOptionTypeForValues: ref(null),
          isLoadingValues: ref(false),
          valueManagementError: ref(null),
          newValueName: ref(''),
          editingValue: ref(null),
          openAddOptionTypeModal: vi.fn(),
          saveOptionType: vi.fn(),
          confirmDeleteOptionType: vi.fn(),
          openManageValuesModal: vi.fn(),
        };
      }
    });
    expect(loadingWrapper.text()).toContain('Loading option types...');
  });

  test('fetches and displays a list of option types', async () => {
    await flushPromises();
    expect(mockAxiosGet).toHaveBeenCalledWith('/api/admin/options');
    expect(wrapper.findAll('ul > li').length).toBe(mockOptionTypes.length);
    expect(wrapper.text()).toContain('Color');
    expect(wrapper.text()).toContain('Size');
  });

  test('"Add New Option Type" button opens a modal', async () => {
    await flushPromises();
    await wrapper.find('button:contains(Add New Option Type)').trigger('click');
    expect(wrapper.vm.showAddEditOptionTypeModal).toBe(true);
    // Example: Check if modal title is correct for adding
    // This requires the modal to be rendered in the test DOM via `mount` or by not stubbing it.
    // For shallowMount, we often test the VM property that controls modal visibility.
  });

  test('submitting the "add option type" modal calls the POST API', async () => {
    await flushPromises();
    wrapper.vm.openAddOptionTypeModal(); // Open modal
    await wrapper.vm.$nextTick(); // Wait for modal state to update

    wrapper.vm.currentOptionType.name = 'Material'; // Set form data
    await wrapper.vm.saveOptionType(); // Call save method

    expect(mockAxiosPost).toHaveBeenCalledWith('/api/admin/options', { name: 'Material' });
    expect(wrapper.vm.showAddEditOptionTypeModal).toBe(false); // Modal should close
    expect(mockAxiosGet).toHaveBeenCalledTimes(2); // Initial fetch + fetch after save
  });

  test('"Manage Values" button fetches and displays values for an option type', async () => {
    await flushPromises();
    // Simulate clicking "Manage Values" for the first option type
    await wrapper.vm.openManageValuesModal(mockOptionTypes[0]);
    await flushPromises(); // for fetchValuesForOptionType

    expect(wrapper.vm.showManageValuesModal).toBe(true);
    expect(wrapper.vm.selectedOptionTypeForValues.name).toBe(mockOptionTypes[0].name);
    expect(mockAxiosGet).toHaveBeenCalledWith(`/api/admin/options/${mockOptionTypes[0].id}/values`);

    // To test if values are rendered, you'd need to ensure the modal's content is part of the wrapper.
    // This might require `mount` or specific checks if the modal is complex.
    // For now, we check if selectedOptionTypeForValues is populated.
    expect(wrapper.vm.selectedOptionTypeForValues.values.length).toBe(mockValuesForColor.length);
  });

  test('adding a new value calls the POST API for values', async () => {
    await flushPromises();
    // First, open the manage values modal for "Color"
    wrapper.vm.selectedOptionTypeForValues = { ...mockOptionTypes[0], values: [...mockValuesForColor] };
    wrapper.vm.showManageValuesModal = true;
    await wrapper.vm.$nextTick();

    wrapper.vm.newValueName = 'Green'; // Set new value name
    await wrapper.vm.addOptionValue();

    expect(mockAxiosPost).toHaveBeenCalledWith(`/api/admin/options/${mockOptionTypes[0].id}/values`, { value: 'Green' });
    expect(mockAxiosGet).toHaveBeenCalledWith(`/api/admin/options/${mockOptionTypes[0].id}/values`); // Refreshes values
    expect(wrapper.vm.newValueName).toBe(''); // Clears input
  });

  test('deleting an option type calls delete API', async () => {
    await flushPromises();
    window.confirm = vi.fn(() => true); // Mock confirm

    await wrapper.vm.confirmDeleteOptionType(mockOptionTypes[0].id);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockAxiosDelete).toHaveBeenCalledWith(`/api/admin/options/${mockOptionTypes[0].id}`);
    expect(mockAxiosGet).toHaveBeenCalledTimes(2); // Initial fetch + fetch after delete
  });

  test('deleting a value calls delete API for option-values', async () => {
    await flushPromises();
    window.confirm = vi.fn(() => true);

    // Setup: Open manage values modal and have a value selected/available
    wrapper.vm.selectedOptionTypeForValues = { ...mockOptionTypes[0], values: [...mockValuesForColor] };
    wrapper.vm.showManageValuesModal = true;
    await wrapper.vm.$nextTick();

    const valueToDelete = mockValuesForColor[0];
    await wrapper.vm.confirmDeleteOptionValue(valueToDelete.id);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockAxiosDelete).toHaveBeenCalledWith(`/api/admin/option-values/${valueToDelete.id}`);
    expect(mockAxiosGet).toHaveBeenCalledWith(`/api/admin/options/${mockOptionTypes[0].id}/values`); // Refreshes values
  });

});
