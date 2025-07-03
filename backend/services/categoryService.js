// backend/services/categoryService.js
const db = require('../db');
const { AppError, BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

/**
 * Creates a new category.
 * @param {string} name - The name of the category.
 * @param {string} [description] - Optional description for the category.
 * @param {number} [parent_category_id] - Optional ID of the parent category.
 * @returns {Promise<object>} The newly created category object.
 * @throws {ConflictError} If a category with the same name already exists.
 * @throws {AppError} If database operation fails.
 */
async function createCategory(name, description, parent_category_id) {
  try {
    const result = await db.query(
      'INSERT INTO categories (name, description, parent_category_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, parent_category_id]
    );
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    // This case should ideally not be reached if INSERT RETURNING * works as expected.
    throw new AppError('Category creation succeeded but failed to return data.', 500, 'CATEGORY_CREATION_NO_DATA');
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'categories_name_key') {
      throw new ConflictError(`A category with the name "${name}" already exists.`);
    }
    // Check for foreign key violation for parent_category_id, though validator should catch this first.
    if (error.code === '23503' && error.constraint === 'categories_parent_category_id_fkey') {
        throw new BadRequestError('Invalid parent_category_id. The specified parent category does not exist.');
    }
    console.error('Error in categoryService.createCategory:', error);
    throw new AppError('Failed to create category due to a server error.', 500, 'CATEGORY_CREATION_FAILED');
  }
}

/**
 * Retrieves a paginated list of all categories.
 * @param {number} page - The current page number.
 * @param {number} limit - The number of categories per page.
 * @returns {Promise<object>} An object containing the list of categories and pagination details.
 * @throws {AppError} If database operation fails.
 */
async function getAllCategories(page, limit) {
  const offset = (page - 1) * limit;
  try {
    const categoriesQuery = `
      SELECT c.id, c.name, c.description, c.parent_category_id, c.updated_at, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id, c.name, c.description, c.parent_category_id, c.updated_at
      ORDER BY c.name ASC
      LIMIT $1 OFFSET $2;
    `;
    const categoriesResult = await db.query(categoriesQuery, [limit, offset]);

    const totalCategoriesQuery = 'SELECT COUNT(*) FROM categories';
    const totalCategoriesResult = await db.query(totalCategoriesQuery);
    const totalCategories = parseInt(totalCategoriesResult.rows[0].count);

    return {
      categories: categoriesResult.rows.map(c => ({...c, product_count: parseInt(c.product_count, 10)})),
      totalCategories,
      page,
      limit,
      totalPages: Math.ceil(totalCategories / limit),
    };
  } catch (error) {
    console.error('Error in categoryService.getAllCategories:', error);
    throw new AppError('Failed to retrieve categories due to a server error.', 500, 'CATEGORY_FETCH_FAILED');
  }
}

/**
 * Retrieves a single category by its ID, including product count.
 * @param {number} categoryId - The ID of the category to retrieve.
 * @returns {Promise<object>} The category object.
 * @throws {NotFoundError} If the category is not found.
 * @throws {AppError} If database operation fails.
 */
async function getCategoryById(categoryId) {
  try {
    const categoryQuery = `
      SELECT c.id, c.name, c.description, c.parent_category_id, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.description, c.parent_category_id;
    `;
    const result = await db.query(categoryQuery, [categoryId]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Category with ID ${categoryId} not found.`);
    }
    const category = result.rows[0];
    category.product_count = parseInt(category.product_count, 10);
    return category;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    console.error(`Error in categoryService.getCategoryById for ID ${categoryId}:`, error);
    throw new AppError(`Failed to retrieve category ID ${categoryId} due to a server error.`, 500, 'CATEGORY_FETCH_BY_ID_FAILED');
  }
}

/**
 * Updates an existing category.
 * @param {number} categoryId - The ID of the category to update.
 * @param {object} updateData - An object containing the fields to update (e.g., name, description, parent_category_id).
 * @returns {Promise<object>} The updated category object.
 * @throws {NotFoundError} If the category is not found.
 * @throws {ConflictError} If the new name conflicts with an existing category name.
 * @throws {BadRequestError} If parent_category_id is invalid (e.g., points to itself or non-existent parent).
 * @throws {AppError} If database operation fails.
 */
async function updateCategory(categoryId, updateData) {
  const { name, description, parent_category_id } = updateData;

  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(name);
  }
  if (updateData.hasOwnProperty('description')) { // Allows setting description to null
    setClauses.push(`description = $${paramIndex++}`);
    values.push(description);
  }
  if (updateData.hasOwnProperty('parent_category_id')) { // Allows setting parent_category_id to null
    if (parent_category_id !== null && parent_category_id === categoryId) {
        throw new BadRequestError('A category cannot be its own parent.');
    }
    setClauses.push(`parent_category_id = $${paramIndex++}`);
    values.push(parent_category_id);
  }

  if (setClauses.length === 0) {
    // If called with no actual data to update, fetch and return current state.
    // Or, could throw BadRequestError('No fields provided for update.');
    // For now, let's assume the route handler ensures at least one field is present based on validation.
    // Fetching current state might be friendlier if this service method is called directly.
    return getCategoryById(categoryId); // Re-use existing method
  }

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(categoryId); // For the WHERE id = $N clause

  const query = `UPDATE categories SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  try {
    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Category with ID ${categoryId} not found. Update failed.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'categories_name_key') {
      throw new ConflictError(`A category with the name "${name}" already exists.`);
    }
    if (error.code === '23503' && error.constraint === 'categories_parent_category_id_fkey') {
      throw new BadRequestError('Invalid parent_category_id. The specified parent category does not exist.');
    }
    console.error(`Error in categoryService.updateCategory for ID ${categoryId}:`, error);
    throw new AppError(`Failed to update category ID ${categoryId} due to a server error.`, 500, 'CATEGORY_UPDATE_FAILED');
  }
}


/**
 * Deletes a category by its ID.
 * It first checks if the category is in use by any products.
 * @param {number} categoryId - The ID of the category to delete.
 * @returns {Promise<void>} Resolves if deletion is successful.
 * @throws {NotFoundError} If the category is not found.
 * @throws {BadRequestError} If the category is in use by products.
 * @throws {AppError} If database operation fails.
 */
async function deleteCategory(categoryId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if category exists first (optional, as DELETE RETURNING would also indicate)
    const categoryCheck = await client.query('SELECT id FROM categories WHERE id = $1 FOR UPDATE', [categoryId]);
    if (categoryCheck.rows.length === 0) {
      throw new NotFoundError(`Category with ID ${categoryId} not found.`);
    }

    // Check if the category is associated with any products
    const productCountResult = await client.query('SELECT COUNT(*) AS count FROM products WHERE category_id = $1', [categoryId]);
    const productCount = parseInt(productCountResult.rows[0].count, 10);

    if (productCount > 0) {
      throw new BadRequestError(`Category is in use by ${productCount} product(s) and cannot be deleted. Please reassign products or delete them first.`);
    }

    // Check for child categories (optional, depends on desired behavior: cascade delete, prevent, or reassign children)
    // For now, let's prevent deletion if it has children, to be safe.
    const childCategoryCountResult = await client.query('SELECT COUNT(*) AS count FROM categories WHERE parent_category_id = $1', [categoryId]);
    const childCount = parseInt(childCategoryCountResult.rows[0].count, 10);
    if (childCount > 0) {
        throw new BadRequestError(`Category has ${childCount} sub-categories. Please delete or reassign them first.`);
    }


    const result = await client.query('DELETE FROM categories WHERE id = $1 RETURNING id', [categoryId]);

    // This check is somewhat redundant if categoryCheck above is done,
    // but good as a final confirmation from the DELETE operation itself.
    if (result.rowCount === 0) {
      // This implies the category was deleted between the check and the delete operation,
      // or it never existed and the initial check failed (less likely with FOR UPDATE).
      throw new NotFoundError(`Category with ID ${categoryId} not found during delete operation.`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      throw error;
    }
    console.error(`Error in categoryService.deleteCategory for ID ${categoryId}:`, error);
    throw new AppError(`Failed to delete category ID ${categoryId} due to a server error.`, 500, 'CATEGORY_DELETE_FAILED');
  } finally {
    client.release();
  }
}

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getAllPublicCategories, // Added new function
  getCategoryBySlug, // Added new function
};

/**
 * Retrieves a single category by its slug.
 * @param {string} slug - The slug of the category to retrieve.
 * @returns {Promise<object|null>} The category object or null if not found.
 * @throws {AppError} If database operation fails.
 */
async function getCategoryBySlug(slug) {
  try {
    // Assuming 'slug' column exists and is unique (or handle multiple results if not unique)
    const query = `
      SELECT id, name, slug, description, parent_category_id, created_at, updated_at
      FROM categories
      WHERE slug = $1;
    `;
    const { rows } = await db.query(query, [slug]);
    if (rows.length > 0) {
      return rows[0]; // Return the first match if any
    }
    return null; // Return null if no category found with that slug
  } catch (error) {
    console.error(`[categoryService.getCategoryBySlug] Error fetching category by slug "${slug}":`, error);
    // It's important not to throw NotFoundError here, as the route handler will do that.
    // Throw a generic AppError for unexpected DB issues.
    throw new AppError(`Failed to retrieve category by slug "${slug}".`, 500, 'CATEGORY_FETCH_BY_SLUG_FAILED');
  }
}


/**
 * Retrieves all categories for public display (typically id and name).
 * @returns {Promise<Array<object>>} A promise that resolves to an array of category objects,
 *          each containing { id, name }, ordered by name.
 * @throws {AppError} If the database operation fails.
 */
async function getAllPublicCategories() {
  try {
    // Assuming a 'slug' column exists in the 'categories' table
    const result = await db.query('SELECT id, name, slug FROM categories WHERE parent_category_id IS NULL ORDER BY name ASC');
    return result.rows.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      // TODO: Potentially fetch children categories if a nested menu is desired
    }));
  } catch (error) {
    console.error('[categoryService.getAllPublicCategories] Error fetching public categories:', error);
    throw new AppError('Failed to retrieve public categories.', 500, 'PUBLIC_CATEGORIES_FETCH_FAILED');
  }
}
