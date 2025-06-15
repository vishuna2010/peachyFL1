const productService = require('../../services/productService'); // Adjust path
const db = require('../../db'); // Adjust path

vi.mock('../../db', () => ({
  query: vi.fn(),
}));

describe('Product Service - getAllProducts', () => {
  beforeEach(() => {
    db.query.mockReset();
    // Default mock for count query, can be overridden in specific tests
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });
    // Default mock for product data query
    db.query.mockResolvedValueOnce({ rows: [] });
  });

  const defaultOptions = {
    page: 1,
    limit: 10,
    sort_order: 'ASC',
  };

  test('No Filters (Public User): defaults to active products', async () => {
    db.query.mockReset(); // Reset for specific mock sequence
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Active Product', product_status: 'active' }] }); // Products
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 1 }] }); // Count

    await productService.getAllProducts({ ...defaultOptions, is_admin_request: false });

    const queryArgs = db.query.mock.calls;
    // First call is products, second is count. Or vice-versa depending on implementation.
    // Let's find the one that selects products.
    const productQueryCall = queryArgs.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
    const countQueryCall = queryArgs.find(call => call[0].includes('SELECT COUNT(DISTINCT p.id)'));

    expect(productQueryCall[0]).toContain("p.product_status = 'active'");
    // Ensure count query also has the status filter
    expect(countQueryCall[0]).toContain("p.product_status = 'active'");
  });

  test('Admin Request (No Status Filter): does NOT automatically filter by active status', async () => {
    db.query.mockReset();
    db.query.mockResolvedValueOnce({ rows: [] }); // Products
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] }); // Count

    await productService.getAllProducts({ ...defaultOptions, is_admin_request: true });

    const queryArgs = db.query.mock.calls;
    const productQueryCall = queryArgs.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));

    expect(productQueryCall[0]).not.toContain("p.product_status = 'active'");
  });

  test('Status Filtering: applies WHERE p.product_status = $X', async () => {
    db.query.mockReset();
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

    await productService.getAllProducts({ ...defaultOptions, status: 'draft', is_admin_request: true });

    const queryArgs = db.query.mock.calls;
    const productQueryCall = queryArgs.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));

    expect(productQueryCall[0]).toContain("p.product_status = $");
    expect(productQueryCall[1]).toContain('draft');
  });

  describe('Stock Status Filtering', () => {
    test('stock_status: "in_stock" applies pes.effective_stock_quantity > 0', async () => {
        db.query.mockReset();
        db.query.mockResolvedValueOnce({ rows: [] });
        db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

        await productService.getAllProducts({ ...defaultOptions, stock_status: 'in_stock', is_admin_request: true });
        const productQueryCall = db.query.mock.calls.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
        expect(productQueryCall[0]).toContain("pes.effective_stock_quantity > 0");
    });

    test('stock_status: "out_of_stock" applies (pes.effective_stock_quantity <= 0 OR pes.effective_stock_quantity IS NULL)', async () => {
        db.query.mockReset();
        db.query.mockResolvedValueOnce({ rows: [] });
        db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

        await productService.getAllProducts({ ...defaultOptions, stock_status: 'out_of_stock', is_admin_request: true });
        const productQueryCall = db.query.mock.calls.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
        expect(productQueryCall[0]).toContain("(pes.effective_stock_quantity <= 0 OR pes.effective_stock_quantity IS NULL)");
    });

    test('stock_status: "low_stock" applies pes.is_low_stock = TRUE', async () => {
        db.query.mockReset();
        db.query.mockResolvedValueOnce({ rows: [] });
        db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

        await productService.getAllProducts({ ...defaultOptions, stock_status: 'low_stock', is_admin_request: true });
        const productQueryCall = db.query.mock.calls.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
        expect(productQueryCall[0]).toContain("pes.is_low_stock = TRUE");
    });
  });

  test('Sorting: applies ORDER BY correctly (e.g. price DESC)', async () => {
    db.query.mockReset();
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

    await productService.getAllProducts({ ...defaultOptions, sortBy: 'price', sort_order: 'DESC', is_admin_request: true });

    const productQueryCall = db.query.mock.calls.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
    expect(productQueryCall[0]).toContain("ORDER BY p.price DESC NULLS LAST");
  });

   test('Sorting by stock: applies ORDER BY pes.effective_stock_quantity', async () => {
    db.query.mockReset();
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

    await productService.getAllProducts({ ...defaultOptions, sortBy: 'stock', sort_order: 'ASC', is_admin_request: true });

    const productQueryCall = db.query.mock.calls.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
    expect(productQueryCall[0]).toContain("ORDER BY pes.effective_stock_quantity ASC NULLS LAST");
  });


  test('include_total_stock: selects pes.effective_stock_quantity as total_stock_display', async () => {
    db.query.mockReset();
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

    await productService.getAllProducts({ ...defaultOptions, include_total_stock: true, is_admin_request: true });

    const productQueryCall = db.query.mock.calls.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
    // The alias total_stock_display is applied to pes.effective_stock_quantity which is already selected
    expect(productQueryCall[0]).toMatch(/pes\.effective_stock_quantity\s+as\s+total_stock_display/i);
  });

  test('Pagination: applies LIMIT and OFFSET correctly', async () => {
    db.query.mockReset();
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

    const page = 3;
    const limit = 5;
    const offset = (page - 1) * limit;
    await productService.getAllProducts({ ...defaultOptions, page, limit, is_admin_request: true });

    const productQueryCall = db.query.mock.calls.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
    expect(productQueryCall[0]).toContain(`LIMIT $`);
    expect(productQueryCall[0]).toContain(`OFFSET $`);
    expect(productQueryCall[1]).toContain(limit);
    expect(productQueryCall[1]).toContain(offset);
  });

  test('Search Term: applies search conditions correctly', async () => {
    db.query.mockReset();
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });
    const searchTerm = 'Test Laptop';

    await productService.getAllProducts({ ...defaultOptions, searchTerm, is_admin_request: true });

    const productQueryCall = db.query.mock.calls.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
    expect(productQueryCall[0]).toContain(`p.name ILIKE $`);
    expect(productQueryCall[0]).toContain(`p.description ILIKE $`);
    expect(productQueryCall[0]).toContain(`p.sku ILIKE $`);
    expect(productQueryCall[0]).toContain(`EXISTS (
        SELECT 1 FROM product_variants pv_search
        WHERE pv_search.product_id = p.id AND pv_search.sku ILIKE $`);
    expect(productQueryCall[1]).toContain(`%${searchTerm}%`);
  });

  test('Combination of Filters (status and stock_status)', async () => {
    db.query.mockReset();
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

    const status = 'active';
    const stockStatus = 'in_stock';

    await productService.getAllProducts({
      ...defaultOptions,
      status,
      stock_status: stockStatus,
      is_admin_request: true
    });

    const productQueryCall = db.query.mock.calls.find(call => call[0].includes('SELECT DISTINCT ON (p.id) p.id, p.name'));
    expect(productQueryCall[0]).toContain(`p.product_status = $`);
    expect(productQueryCall[1]).toContain(status);
    expect(productQueryCall[0]).toContain(`pes.effective_stock_quantity > 0`);
  });

});
