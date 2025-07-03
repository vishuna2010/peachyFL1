const optionService = require('../../services/optionService');
const db = require('../../db');
const { NotFoundError, ConflictError, BadRequestError, AppError } = require('../../utils/AppError');

vi.mock('../../db', () => ({
  query: vi.fn(),
  pool: { // Mock pool for services that might use client directly (like deleteOptionType)
    connect: vi.fn(() => ({
      query: vi.fn(),
      release: vi.fn(),
    })),
  }
}));

describe('Option Service', () => {
  let mockClient;

  beforeEach(() => {
    db.query.mockReset();
    // Setup mock client for functions that use transactions
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    db.pool.connect.mockReturnValue(mockClient);
  });

  // === Option Types ===
  describe('createOptionType', () => {
    test('should create an option type successfully', async () => {
      const mockOptionType = { id: 1, name: 'Color' };
      db.query.mockResolvedValueOnce({ rows: [mockOptionType], rowCount: 1 });
      const result = await optionService.createOptionType('Color');
      expect(db.query).toHaveBeenCalledWith('INSERT INTO product_options (name) VALUES ($1) RETURNING *', ['Color']);
      expect(result).toEqual(mockOptionType);
    });

    test('should throw ConflictError if option type name already exists', async () => {
      db.query.mockRejectedValueOnce({ code: '23505', constraint: 'product_options_name_key' });
      await expect(optionService.createOptionType('Color')).rejects.toThrow(ConflictError);
    });
  });

  describe('getAllOptionTypes', () => {
    test('should return all option types', async () => {
      const mockOptionTypes = [{ id: 1, name: 'Color' }, { id: 2, name: 'Size' }];
      db.query.mockResolvedValueOnce({ rows: mockOptionTypes });
      const result = await optionService.getAllOptionTypes();
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM product_options ORDER BY name ASC');
      expect(result).toEqual(mockOptionTypes);
    });
  });

  describe('getOptionTypeById', () => {
    test('should return an option type by ID', async () => {
      const mockOptionType = { id: 1, name: 'Color' };
      db.query.mockResolvedValueOnce({ rows: [mockOptionType] });
      const result = await optionService.getOptionTypeById(1);
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM product_options WHERE id = $1', [1]);
      expect(result).toEqual(mockOptionType);
    });

    test('should throw NotFoundError if option type not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(optionService.getOptionTypeById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateOptionType', () => {
    test('should update an option type successfully', async () => {
      const updatedOptionType = { id: 1, name: 'Material' };
      db.query.mockResolvedValueOnce({ rows: [updatedOptionType], rowCount: 1 });
      const result = await optionService.updateOptionType(1, 'Material');
      expect(db.query).toHaveBeenCalledWith('UPDATE product_options SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *', ['Material', 1]);
      expect(result).toEqual(updatedOptionType);
    });

    test('should throw NotFoundError if option type to update not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(optionService.updateOptionType(999, 'Material')).rejects.toThrow(NotFoundError);
    });

    test('should throw ConflictError if updated name conflicts', async () => {
      db.query.mockRejectedValueOnce({ code: '23505', constraint: 'product_options_name_key' });
      await expect(optionService.updateOptionType(1, 'ExistingName')).rejects.toThrow(ConflictError);
    });
  });

  describe('deleteOptionType', () => {
    test('should delete an option type if it has no values', async () => {
      const mockOptionType = { id: 1, name: 'DisposableOption' };
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockOptionType] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // COUNT product_option_values
        .mockResolvedValueOnce({ rows: [mockOptionType], rowCount: 1 }); // DELETE

      const result = await optionService.deleteOptionType(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT COUNT(*) FROM product_option_values WHERE product_option_id = $1', [1]);
      expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM product_options WHERE id = $1 RETURNING *', [1]);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual(mockOptionType);
    });

    test('should throw BadRequestError if option type has associated values', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Color' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ count: '3' }] });          // COUNT product_option_values

      await expect(optionService.deleteOptionType(1)).rejects.toThrow(BadRequestError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
     test('should throw NotFoundError if option type to delete not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // SELECT FOR UPDATE returns no rows
      await expect(optionService.deleteOptionType(999)).rejects.toThrow(NotFoundError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK'); // Ensure rollback on not found
    });
  });

  // === Option Values ===
  describe('createOptionValue', () => {
    test('should create an option value successfully', async () => {
      const mockOptionValue = { id: 10, product_option_id: 1, value: 'Red' };
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Color' }] }) // Parent option type check
        .mockResolvedValueOnce({ rows: [mockOptionValue], rowCount: 1 });   // Insert value

      const result = await optionService.createOptionValue(1, 'Red');
      expect(db.query).toHaveBeenCalledWith('SELECT id FROM product_options WHERE id = $1', [1]);
      expect(db.query).toHaveBeenCalledWith('INSERT INTO product_option_values (product_option_id, value) VALUES ($1, $2) RETURNING *', [1, 'Red']);
      expect(result).toEqual(mockOptionValue);
    });

    test('should throw NotFoundError if parent option type does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // Parent option type check fails
      await expect(optionService.createOptionValue(999, 'Red')).rejects.toThrow(NotFoundError);
    });

    test('should throw ConflictError if value already exists for the option type', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Color' }] }); // Parent option type check
      db.query.mockRejectedValueOnce({ code: '23505', constraint: 'uk_option_value' }); // Insert fails
      await expect(optionService.createOptionValue(1, 'Red')).rejects.toThrow(ConflictError);
    });
  });

  describe('getAllOptionValuesForType', () => {
    test('should return all values for a given option type ID', async () => {
        const mockValues = [{id: 1, value: "Red"}, {id: 2, value: "Blue"}];
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Color'}] }); // Check option type exists
        db.query.mockResolvedValueOnce({ rows: mockValues }); // Get values

        const result = await optionService.getAllOptionValuesForType(1);
        expect(db.query).toHaveBeenCalledWith('SELECT id FROM product_options WHERE id = $1', [1]);
        expect(db.query).toHaveBeenCalledWith('SELECT * FROM product_option_values WHERE product_option_id = $1 ORDER BY value ASC', [1]);
        expect(result).toEqual(mockValues);
    });

    test('should throw NotFoundError if parent option type does not exist', async () => {
        db.query.mockResolvedValueOnce({ rows: [] }); // Option type check fails
        await expect(optionService.getAllOptionValuesForType(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getOptionValueById', () => {
     test('should return an option value by ID', async () => {
      const mockOptionValue = { id: 1, product_option_id: 1, value: 'Red' };
      db.query.mockResolvedValueOnce({ rows: [mockOptionValue] });
      const result = await optionService.getOptionValueById(1);
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM product_option_values WHERE id = $1', [1]);
      expect(result).toEqual(mockOptionValue);
    });

    test('should throw NotFoundError if option value not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(optionService.getOptionValueById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateOptionValue', () => {
     test('should update an option value successfully', async () => {
      const updatedOptionValue = { id: 1, product_option_id: 1, value: 'Dark Red' };
      db.query.mockResolvedValueOnce({ rows: [{product_option_id: 1}] }); // Current value data for check
      db.query.mockResolvedValueOnce({ rows: [updatedOptionValue], rowCount: 1 }); // Update query
      const result = await optionService.updateOptionValue(1, 'Dark Red');
      expect(db.query).toHaveBeenCalledWith('UPDATE product_option_values SET value = $1, updated_at = NOW() WHERE id = $2 RETURNING *', ['Dark Red', 1]);
      expect(result).toEqual(updatedOptionValue);
    });

    test('should throw NotFoundError if option value to update not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Current value data check fails
      await expect(optionService.updateOptionValue(999, 'Maroon')).rejects.toThrow(NotFoundError);
    });

    test('should throw ConflictError if updated value conflicts', async () => {
      db.query.mockResolvedValueOnce({ rows: [{product_option_id: 1}] }); // Current value data
      db.query.mockRejectedValueOnce({ code: '23505', constraint: 'uk_option_value' }); // Update query fails
      await expect(optionService.updateOptionValue(1, 'ExistingValue')).rejects.toThrow(ConflictError);
    });
  });

  describe('deleteOptionValue', () => {
    test('should delete an option value if not in use', async () => {
      const mockValue = { id:1, value: "Test Value" };
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockValue] }) // SELECT FOR UPDATE product_option_values
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // COUNT product_variant_option_values
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // COUNT product_assigned_option_specific_values
        .mockResolvedValueOnce({ rows: [mockValue], rowCount: 1 }); // DELETE

      const result = await optionService.deleteOptionValue(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT COUNT(*) FROM product_variant_option_values WHERE product_option_value_id = $1', [1]);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT COUNT(*) FROM product_assigned_option_specific_values WHERE product_option_value_id = $1', [1]);
      expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM product_option_values WHERE id = $1 RETURNING *', [1]);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual(mockValue);
    });

    test('should throw BadRequestError if option value is used in variants', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1, value: 'Red' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });         // COUNT product_variant_option_values

      await expect(optionService.deleteOptionValue(1)).rejects.toThrow(BadRequestError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('should throw BadRequestError if option value is used in product assignments', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1, value: 'Red' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })         // COUNT product_variant_option_values
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });        // COUNT product_assigned_option_specific_values

      await expect(optionService.deleteOptionValue(1)).rejects.toThrow(BadRequestError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
