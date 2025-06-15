const taxService = require('../../services/taxService'); // Adjust if path is different
const db = require('../../db'); // Adjust path

// Mock the db module
vi.mock('../../db', () => ({
  query: vi.fn(),
}));

describe('Tax Service - calculatePriceWithAppliedTaxes', () => {
  beforeEach(() => {
    // Reset the mock before each test
    db.query.mockReset();
  });

  test('taxClassId is null: should return zero tax and original basePrice', async () => {
    const result = await taxService.calculatePriceWithAppliedTaxes(100.00, null);
    expect(result).toEqual({
      basePrice: '100.00',
      taxAmount: '0.00',
      priceWithTax: '100.00',
      appliedRates: [],
    });
  });

  test('basePrice is null: should return null prices and zero tax', async () => {
    const result = await taxService.calculatePriceWithAppliedTaxes(null, 1);
    expect(result).toEqual({
      basePrice: null,
      taxAmount: '0.00',
      priceWithTax: null,
      appliedRates: [],
    });
  });

  test('basePrice is zero: should return zero for all amounts', async () => {
    // Mock db query for fetching tax rates, even though they won't affect amount if base is 0
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'VAT', rate_percentage: '20.00', type: 'VAT' }] });
    const result = await taxService.calculatePriceWithAppliedTaxes(0.00, 1);
    expect(result).toEqual({
      basePrice: '0.00',
      taxAmount: '0.00',
      priceWithTax: '0.00',
      appliedRates: [{ id: 1, name: 'VAT', rate_percentage: 20.00, amount: '0.00' }],
    });
  });

  test('No tax rates found for a valid taxClassId: should return zero tax', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // No rates found
    const result = await taxService.calculatePriceWithAppliedTaxes(100.00, 1);
    expect(result).toEqual({
      basePrice: '100.00',
      taxAmount: '0.00',
      priceWithTax: '100.00',
      appliedRates: [],
    });
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [1]);
  });

  test('Single active tax rate for a class: verify correct calculation', async () => {
    const mockRates = [{ id: 1, name: 'VAT', rate_percentage: '20.00', type: 'VAT' }];
    db.query.mockResolvedValueOnce({ rows: mockRates });
    const result = await taxService.calculatePriceWithAppliedTaxes(100.00, 1);
    expect(result).toEqual({
      basePrice: '100.00',
      taxAmount: '20.00',
      priceWithTax: '120.00',
      appliedRates: [{ id: 1, name: 'VAT', rate_percentage: 20.00, amount: '20.00' }],
    });
  });

  test('Multiple active tax rates for a class (summation): verify correct calculation', async () => {
    const mockRates = [
      { id: 1, name: 'VAT', rate_percentage: '20.00', type: 'VAT' },
      { id: 2, name: 'Eco Tax', rate_percentage: '5.00', type: 'ECO' },
    ];
    db.query.mockResolvedValueOnce({ rows: mockRates });
    const result = await taxService.calculatePriceWithAppliedTaxes(100.00, 1);
    expect(result).toEqual({
      basePrice: '100.00',
      taxAmount: '25.00', // 20 (VAT) + 5 (Eco Tax)
      priceWithTax: '125.00',
      appliedRates: [
        { id: 1, name: 'VAT', rate_percentage: 20.00, amount: '20.00' },
        { id: 2, name: 'Eco Tax', rate_percentage: 5.00, amount: '5.00' },
      ],
    });
  });

  test('Tax rate is inactive: should not be applied (DB query filters this)', async () => {
    // The function relies on the DB query to only fetch active rates.
    // So, if an inactive rate was somehow passed (which it shouldn't be by current SQL),
    // the test for "No tax rates found" or calculation with an empty array covers it.
    // This test confirms the SQL query itself in the function is expected to handle it.
    db.query.mockResolvedValueOnce({ rows: [] }); // Simulate DB returning no *active* rates
    const result = await taxService.calculatePriceWithAppliedTaxes(100.00, 1);
     expect(result.taxAmount).toBe('0.00');
    expect(db.query.mock.calls[0][0]).toContain('tr.is_active = TRUE');
  });

  test('Handles database query error gracefully', async () => {
    db.query.mockRejectedValueOnce(new Error('DB connection error'));
    await expect(taxService.calculatePriceWithAppliedTaxes(100.00, 1))
      .rejects.toThrow('DB connection error');
  });

  test('Uses dbClientOptional if provided', async () => {
    const mockDbClient = { query: vi.fn() };
    mockDbClient.query.mockResolvedValueOnce({ rows: [] }); // No rates

    await taxService.calculatePriceWithAppliedTaxes(100.00, 1, mockDbClient);
    expect(mockDbClient.query).toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled(); // Ensure default db.query was not called
  });

  test('Correctly formats numbers with various decimal places in basePrice', async () => {
    const mockRates = [{ id: 1, name: 'Std Rate', rate_percentage: '10.00', type: 'Sales' }];
    db.query.mockResolvedValueOnce({ rows: mockRates });

    const result1 = await taxService.calculatePriceWithAppliedTaxes(123.456, 1);
    expect(result1.basePrice).toBe('123.46'); // Assuming rounding for basePrice display
    expect(result1.taxAmount).toBe('12.35'); // 10% of 123.456 is 12.3456, rounds to 12.35
    expect(result1.priceWithTax).toBe('135.81'); // 123.456 + 12.3456 = 135.8016

    db.query.mockResolvedValueOnce({ rows: mockRates }); // Mock again for next call
    const result2 = await taxService.calculatePriceWithAppliedTaxes(99.99, 1);
    expect(result2.basePrice).toBe('99.99');
    expect(result2.taxAmount).toBe('10.00'); // 10% of 99.99 is 9.999, rounds to 10.00
    expect(result2.priceWithTax).toBe('109.99'); // 99.99 + 9.999 = 109.989
  });
   test('Handles tax rate with non-numeric percentage gracefully', async () => {
    const mockRates = [{ id: 1, name: 'Corrupt Rate', rate_percentage: 'INVALID', type: 'VAT' }];
    db.query.mockResolvedValueOnce({ rows: mockRates });
    // Spy on console.warn
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await taxService.calculatePriceWithAppliedTaxes(100.00, 1);
    expect(result.taxAmount).toBe('0.00'); // Corrupt rate should be skipped
    expect(result.appliedRates.length).toBe(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid rate_percentage for tax rate ID 1: INVALID');

    consoleWarnSpy.mockRestore(); // Restore original console.warn
  });
});
