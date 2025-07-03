const cmsService = require('../../services/cmsService');
const db = require('../../db');
const { NotFoundError, AppError } = require('../../utils/AppError');

vi.mock('../../db', () => ({
  query: vi.fn(),
}));

describe('CMS Service - Hero Banners', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  // Helper to mock DB responses for hero banner queries
  const mockBannerDbResponse = (banners = []) => {
    db.query.mockResolvedValueOnce({ rows: banners, rowCount: banners.length });
  };
  const mockBannerCountDbResponse = (count = 0) => {
    db.query.mockResolvedValueOnce({ rows: [{ count: String(count) }] });
  };


  describe('getActiveHeroBanners', () => {
    test('should fetch active hero banners and map them to camelCase', async () => {
      const mockBanners = [
        { id: 1, title: 'Banner 1', subtitle: 'Sub1', button_text: 'Btn1', button_link: '/link1', image_url: '/img1.png', alt_text: 'Alt1', is_active: true, sort_order: 1, created_at: new Date(), updated_at: new Date() },
        { id: 2, title: 'Banner 2', subtitle: 'Sub2', button_text: 'Btn2', button_link: '/link2', image_url: '/img2.png', alt_text: 'Alt2', is_active: true, sort_order: 0, created_at: new Date(), updated_at: new Date() },
      ];
      mockBannerDbResponse(mockBanners);

      const result = await cmsService.getActiveHeroBanners();

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE is_active = TRUE'), undefined);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY sort_order ASC, created_at DESC'), undefined);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 1, title: 'Banner 1', buttonText: 'Btn1', imageUrl: '/img1.png'
      }));
      expect(result[1]).toEqual(expect.objectContaining({
        id: 2, title: 'Banner 2', buttonText: 'Btn2', imageUrl: '/img2.png'
      }));
    });

    test('should return empty array if no active banners found', async () => {
      mockBannerDbResponse([]);
      const result = await cmsService.getActiveHeroBanners();
      expect(result).toEqual([]);
    });
  });

  describe('getAllHeroBanners', () => {
    test('should fetch all hero banners with default pagination and sort, mapping to camelCase', async () => {
        const mockBanners = [{ id: 1, title: 'Admin Banner 1', button_text: 'Admin Btn1' }];
        // Mock for banner data query then count query
        db.query.mockResolvedValueOnce({ rows: mockBanners, rowCount: mockBanners.length }); // Data
        mockBannerCountDbResponse(1); // Count

        const result = await cmsService.getAllHeroBanners({});

        expect(db.query.mock.calls[0][0]).toContain('ORDER BY sort_order ASC');
        expect(db.query.mock.calls[0][1]).toEqual([10, 0]); // Default limit 10, offset 0
        expect(db.query.mock.calls[1][0]).toContain('SELECT COUNT(*) FROM hero_banners;');

        expect(result.banners).toHaveLength(1);
        expect(result.banners[0].buttonText).toBe('Admin Btn1');
        expect(result.currentPage).toBe(1);
        expect(result.totalPages).toBe(1);
        expect(result.totalBanners).toBe(1);
    });

    test('should apply custom pagination and sorting', async () => {
        mockBannerDbResponse([]); // Data
        mockBannerCountDbResponse(0); // Count

        await cmsService.getAllHeroBanners({ page: 2, limit: 5, sortBy: 'title', sortOrder: 'DESC' });

        expect(db.query.mock.calls[0][0]).toContain('ORDER BY title DESC');
        expect(db.query.mock.calls[0][1]).toEqual([5, 5]); // Limit 5, Page 2 -> Offset 5
    });
  });

  describe('createHeroBanner', () => {
    test('should insert a new hero banner and return it mapped to camelCase', async () => {
      const bannerData = { title: 'New Banner', subtitle: 'New Sub', buttonText: 'New Btn', buttonLink: '/new', imageUrl: '/new.png', altText: 'New Alt', isActive: true, sortOrder: 10 };
      const dbBanner = { ...bannerData, id: 3, button_text: bannerData.buttonText, image_url: bannerData.imageUrl, alt_text: bannerData.altText, is_active: bannerData.isActive, sort_order: bannerData.sortOrder };
      mockBannerDbResponse([dbBanner]);

      const result = await cmsService.createHeroBanner(bannerData);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO hero_banners'),
        [bannerData.title, bannerData.subtitle, bannerData.buttonText, bannerData.buttonLink, bannerData.imageUrl, bannerData.altText, bannerData.isActive, bannerData.sortOrder]
      );
      expect(result).toEqual(expect.objectContaining({ id: 3, title: 'New Banner', buttonText: 'New Btn' }));
    });
  });

  describe('getHeroBannerById', () => {
    test('should fetch a banner by ID and map to camelCase', async () => {
      const dbBanner = { id: 1, title: 'Fetched Banner', button_text: 'Fetched Btn' };
      mockBannerDbResponse([dbBanner]);
      const result = await cmsService.getHeroBannerById(1);
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM hero_banners WHERE id = $1;', [1]);
      expect(result).toEqual(expect.objectContaining({ id: 1, title: 'Fetched Banner', buttonText: 'Fetched Btn' }));
    });

    test('should throw NotFoundError if banner not found', async () => {
      mockBannerDbResponse([]);
      await expect(cmsService.getHeroBannerById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateHeroBanner', () => {
    test('should update a banner and return it mapped to camelCase', async () => {
      const updateData = { title: 'Updated Banner', subtitle: 'Updated Sub', buttonText: 'Updated Btn', buttonLink: '/updated', imageUrl: '/updated.png', altText: 'Updated Alt', isActive: false, sortOrder: 5 };
      const dbBanner = { ...updateData, id: 1, button_text: updateData.buttonText, image_url: updateData.imageUrl, alt_text: updateData.altText, is_active: updateData.isActive, sort_order: updateData.sortOrder };
      mockBannerDbResponse([dbBanner]);

      const result = await cmsService.updateHeroBanner(1, updateData);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE hero_banners SET'),
        [updateData.title, updateData.subtitle, updateData.buttonText, updateData.buttonLink, updateData.imageUrl, updateData.altText, updateData.isActive, updateData.sortOrder, 1]
      );
      expect(result).toEqual(expect.objectContaining({ id: 1, title: 'Updated Banner' }));
    });

    test('should throw NotFoundError if banner to update is not found', async () => {
      mockBannerDbResponse([]); // Simulate no row returned from UPDATE ... RETURNING
      const updateData = { title: 'NonExistent Update' };
      await expect(cmsService.updateHeroBanner(999, updateData)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteHeroBanner', () => {
    test('should delete a banner and return its data mapped to camelCase', async () => {
      const dbBanner = { id: 1, title: 'Deleted Banner', button_text: 'Delete Btn' };
      mockBannerDbResponse([dbBanner]); // Simulate RETURNING the deleted row

      const result = await cmsService.deleteHeroBanner(1);
      expect(db.query).toHaveBeenCalledWith('DELETE FROM hero_banners WHERE id = $1 RETURNING *;', [1]);
      expect(result).toEqual(expect.objectContaining({ id: 1, title: 'Deleted Banner' }));
    });

    test('should throw NotFoundError if banner to delete is not found', async () => {
      mockBannerDbResponse([]); // Simulate no row returned from DELETE ... RETURNING
      await expect(cmsService.deleteHeroBanner(999)).rejects.toThrow(NotFoundError);
    });
  });
});
