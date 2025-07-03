const request = require('supertest');
const express = require('express');
const { optionsRouter, optionValuesRouter } = require('../../routes/adminOptionManagement'); // Path to the routers
const optionService = require('../../services/optionService');
const { isAuthenticated, checkPermission } = require('../../auth');

// Mock a simplified app
const app = express();
app.use(express.json());

// Mock auth middleware
vi.mock('../../auth', () => ({
  isAuthenticated: vi.fn((req, res, next) => {
    req.user = { userId: 1, email: 'admin@example.com' }; // Mock user
    next();
  }),
  checkPermission: vi.fn((permission) => (req, res, next) => {
    if (permission === 'options:manage_global') { // Simulate this permission check passing
      return next();
    }
    return res.status(403).json({ message: 'Forbidden' }); // Default deny
  }),
}));

// Mock optionService
vi.mock('../../services/optionService');

// Mount routers
app.use('/api/admin/options', optionsRouter);
app.use('/api/admin/option-values', optionValuesRouter);

describe('Admin Option Management Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // === Product Options Routes (/api/admin/options) ===
  describe('optionsRouter', () => {
    describe('POST /api/admin/options', () => {
      test('should create an option type', async () => {
        const mockNewOptionType = { id: 1, name: 'Color' };
        optionService.createOptionType.mockResolvedValue(mockNewOptionType);
        const response = await request(app).post('/api/admin/options').send({ name: 'Color' });
        expect(response.status).toBe(201);
        expect(response.body).toEqual(mockNewOptionType);
        expect(optionService.createOptionType).toHaveBeenCalledWith('Color');
      });
      test('should return 400 for invalid data', async () => {
        const response = await request(app).post('/api/admin/options').send({ name: '' }); // Empty name
        expect(response.status).toBe(400);
        expect(optionService.createOptionType).not.toHaveBeenCalled();
      });
    });

    describe('GET /api/admin/options', () => {
      test('should get all option types', async () => {
        const mockOptionTypes = [{ id: 1, name: 'Color' }];
        optionService.getAllOptionTypes.mockResolvedValue(mockOptionTypes);
        const response = await request(app).get('/api/admin/options');
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockOptionTypes);
      });
    });

    describe('GET /api/admin/options/:optionId', () => {
      test('should get an option type by ID', async () => {
        const mockOptionType = { id: 1, name: 'Color' };
        optionService.getOptionTypeById.mockResolvedValue(mockOptionType);
        const response = await request(app).get('/api/admin/options/1');
        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockOptionType);
        expect(optionService.getOptionTypeById).toHaveBeenCalledWith(1);
      });
    });

    describe('PUT /api/admin/options/:optionId', () => {
      test('should update an option type', async () => {
        const updatedOptionType = { id: 1, name: 'Material' };
        optionService.updateOptionType.mockResolvedValue(updatedOptionType);
        const response = await request(app).put('/api/admin/options/1').send({ name: 'Material' });
        expect(response.status).toBe(200);
        expect(response.body).toEqual(updatedOptionType);
        expect(optionService.updateOptionType).toHaveBeenCalledWith(1, 'Material');
      });
    });

    describe('DELETE /api/admin/options/:optionId', () => {
      test('should delete an option type', async () => {
        optionService.deleteOptionType.mockResolvedValue({ id: 1, name: 'Color' }); // Service might return deleted item
        const response = await request(app).delete('/api/admin/options/1');
        expect(response.status).toBe(204);
        expect(optionService.deleteOptionType).toHaveBeenCalledWith(1);
      });
    });

    // Option Values nested under Options
    describe('POST /api/admin/options/:optionId/values', () => {
      test('should create an option value for an option type', async () => {
        const mockNewValue = { id: 10, product_option_id: 1, value: 'Red' };
        optionService.createOptionValue.mockResolvedValue(mockNewValue);
        const response = await request(app).post('/api/admin/options/1/values').send({ value: 'Red' });
        expect(response.status).toBe(201);
        expect(response.body).toEqual(mockNewValue);
        expect(optionService.createOptionValue).toHaveBeenCalledWith(1, 'Red');
      });
    });

    describe('GET /api/admin/options/:optionId/values', () => {
      test('should get all values for an option type', async () => {
        const mockValues = [{ id: 10, value: 'Red' }];
        optionService.getAllOptionValuesForType.mockResolvedValue(mockValues);
        const response = await request(app).get('/api/admin/options/1/values');
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockValues);
        expect(optionService.getAllOptionValuesForType).toHaveBeenCalledWith(1);
      });
    });
  });

  // === Standalone Option Values Routes (/api/admin/option-values) ===
  describe('optionValuesRouter', () => {
    describe('GET /api/admin/option-values/:valueId', () => {
      test('should get an option value by ID', async () => {
        const mockValue = { id: 10, product_option_id: 1, value: 'Red' };
        optionService.getOptionValueById.mockResolvedValue(mockValue);
        const response = await request(app).get('/api/admin/option-values/10');
        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockValue);
        expect(optionService.getOptionValueById).toHaveBeenCalledWith(10);
      });
    });

    describe('PUT /api/admin/option-values/:valueId', () => {
      test('should update an option value', async () => {
        const updatedValue = { id: 10, product_option_id: 1, value: 'Dark Red' };
        optionService.updateOptionValue.mockResolvedValue(updatedValue);
        const response = await request(app).put('/api/admin/option-values/10').send({ value: 'Dark Red' });
        expect(response.status).toBe(200);
        expect(response.body).toEqual(updatedValue);
        expect(optionService.updateOptionValue).toHaveBeenCalledWith(10, 'Dark Red');
      });
    });

    describe('DELETE /api/admin/option-values/:valueId', () => {
      test('should delete an option value', async () => {
        optionService.deleteOptionValue.mockResolvedValue({ id: 10, value: 'Red' }); // Service might return deleted
        const response = await request(app).delete('/api/admin/option-values/10');
        expect(response.status).toBe(204);
        expect(optionService.deleteOptionValue).toHaveBeenCalledWith(10);
      });
    });
  });
});
