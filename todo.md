# Project To-Do List & Future Enhancements

This document consolidates future enhancements and pending tasks for the platform.

---

## I. Storefront UI/UX (Customer Facing)

### A. Product Listing Page (PLP - `pages/index.vue`)
- **Advanced Filters UI (Phase 2+):**
  - Implement collapsible sidebar for filters on desktop. *(DONE - Basic structure implemented)*
  - Implement modal/drawer for filters on mobile. *(DONE - Basic structure implemented)*
  - [X] Add visual filters: Color swatches implemented for "Color" option on PLP.
  - [X] Enhance price range filter with improved number inputs, validation, and styling (deferred more visual slider).
- **General UI/UX:**
  - Further review and refine global typography (Poppins font, scale, line heights, spacing).
  - Design more engaging and helpful empty state components (e.g., "No products match your filters").

### B. Product Detail Page (PDP - `pages/products/[id].vue`)
- **Image Gallery Phase 2:**
  - Implement click-to-zoom on main image. *(DONE)*
  - Improve thumbnail interactions (e.g., better scrolling for many images). *(DONE - basic scroll, active styling)*
- **Variant Selector Refinement:**
  - [X] Display visual swatches for "Color" options on PDP selector.
  - Ensure "Size" or other options are clear and possibly indicate stock per selection dynamically.
- **Product Information Tabs:** *(DONE - Description, Specs (placeholder), Reviews (placeholder))*
  - Enhance "Specifications" tab with actual data if/when available from backend.
- **Customer Reviews Display:**
  - Display list of approved public reviews in the "Reviews" tab. *(DONE)*
- **Customer Review Submission:**
  - UI for users to submit new reviews. *(DONE - ReviewForm.vue and PDP integration)*

### C. User Authentication & Profile
- **Login/Registration Pages (`pages/login.vue`, `pages/register.vue`):**
  - Style with Tailwind CSS. *(DONE)*
- **Core User Profile Features (`pages/profile/*.vue`):**
  - Connect "My Orders" list page to backend API. *(DONE - Verified existing)*
  - Connect "Order Detail" page to backend API. *(DONE - Verified existing)*
  - Implement "Change Password" functionality. *(DONE)*
  - Implement "Update Profile Details" (e.g., user's name). *(DONE)*

### D. General UI Polish & Feedback
- **Interactive Feedback (Phase 2+):**
  - Implement Skeleton Loaders for PLP, PDP, Order History. *(DONE)*
  - Refine Toast Notification usage/styling if needed.
- **Empty States & Error Pages:**
  - Design more engaging and helpful empty state components throughout the application.
  - Ensure the custom 404 page (`error.vue`) is robust and potentially add more specific error pages.

---

## II. Admin Panel UI/UX

### A. Dashboard (`pages/admin/index.vue`)
- Implement actual data fetching for Stat Cards. *(DONE)*
- Integrate basic charts (e.g., sales over time - requires backend data source).
- Implement "Recent Activity" and "Recent Orders Table" sections with real data.

### B. Core Page Styling & Structure
- **Refactor Key Admin Pages with Tailwind CSS:**
  - [X] `admin/users/index.vue`
  - `admin/products/index.vue` *(DONE)*
  - [X] `admin/products/new.vue / edit/[id].vue`
  - `admin/orders/index.vue` / `[id].vue`
  - (Other admin pages as they are developed).
- Create reusable admin-specific form components if beneficial.

### C. Layout & Navigation
- Add SVG icons to all `AdminSidebar.vue` navigation items. *(DONE)*
- Implement breadcrumb navigation within the admin section.
- Implement a functional global search bar in the top admin bar (for searching orders, products, users etc.).
- Add notification icon/dropdown placeholder in top admin bar.
- Consider more sophisticated collapse mechanism for the sidebar (e.g., icon-only view).

### D. Category Management
- Create `frontend/pages/admin/categories/index.vue`. *(DONE)*
- Create `frontend/pages/admin/categories/new.vue`. *(DONE)*
- Create `frontend/pages/admin/categories/edit/[id].vue`. *(DONE)*

### E. Product Option & Variant Management (New Section)
- **Global Product Options UI:**
  - Page to manage global option types (`/admin/options/index.vue`). *(DONE)*
  - Page to manage global values for an option type (`/admin/options/[optionId]/values.vue`). *(DONE)*
- **Product-Specific Variant UI (likely within product edit page `/admin/products/edit/[id].vue` or a dedicated sub-page):**
  - [X] Assign global options to a specific product (UI implemented in ProductOptionsManager on product edit page).
  - [X] Specify which global option values are applicable for that product's assigned options (UI implemented on `.../manage-values.vue` page).
  - [X] Create/edit/delete variants based on combinations of these values (setting SKU, price modifier, stock, image). (Display, Add Form & Logic, Edit Form & Logic, Delete Logic implemented).

### F. Review Moderation
- Create Admin Page for Review Moderation (`/admin/reviews/index.vue`). *(DONE)*

### G. Inventory Control (Menu Structure from previous `todo.md`)

  - **I. Dashboard / Overview**
    - A. Inventory Summary (key metrics, quick links).
    - B. Recent Inventory Activity Log.
  - **II. Products / Stock Management**
    - A. Stock Levels View (filterable, searchable, committed vs. available).
    - B. Manual Stock Adjustments (with reason codes, history).
    - C. Stock Takes / Cycle Counting.
    - D. Product Reorder Thresholds Management (UI for existing DB fields).
    - E. Stock Movement Tracking (Advanced - for multi-location).
  - **III. Purchase Orders (POs)**
    - A. Manage Purchase Orders (CRUD, send to supplier).
    - B. Receiving Stock (Goods In) against POs.
    - C. PO History & Reporting.
  - **IV. Suppliers**
    - A. Manage Suppliers (CRUD already exists, ensure UI is styled).
    - B. Supplier Performance (Advanced).
  - **V. Inventory Reporting**
    - A. Low Stock Report (UI for existing backend endpoint).
    - B. Stock Valuation Report.
    - C. Inventory History/Audit Trail Report.
    - D. Sales Velocity Report (Advanced).
    - E. Dead Stock Report (Advanced).
  - **VI. Settings (Inventory Specific)**
    - A. Default Units of Measure.
    - B. Reason Codes for Stock Adjustments.
    - C. Warehouse/Location Management (Advanced - for multi-location).

### H. Reporting
- Create `frontend/pages/admin/reports/index.vue` (as a dashboard for various reports).

---

## III. Backend Features & Enhancements

### A. Core User Features
- API endpoint for "Change Password". *(DONE)*
- Define updatable "Profile Details" and create corresponding API endpoint(s). *(DONE - for user name)*

### B. Product Variants & Options
- Full backend logic for product variants (options, values, variants, specific configurations). *(DONE - Phase 1: DB Schema, Global Options API, Product-Specific Options API, Variants API)*
- Ensure variants correctly impact SKU, price, and stock quantity. *(DONE - `price_modifier` used, stock on variant)*
- API endpoints for managing options and variants associated with products. *(DONE)*
- Update public product API (`GET /api/products/:id`) to return variant info. *(DONE)*

### C. Customer Reviews & Ratings
- Database schema for reviews. *(DONE)*
- API endpoints for submitting reviews. *(DONE)*
- API endpoints for retrieving (paginated) approved reviews for a product. *(DONE)*
- Admin API endpoints for moderating reviews (list, update status, delete). *(DONE)*
- Logic for calculating and storing average ratings / review counts on products table. *(DONE)*
- API endpoint for user to get their own review for a product. *(DONE)*

### D. Advanced Features (New or To Be Detailed)
- **Advanced Shipping & Tax Calculation:**
  - Develop or integrate modules for complex shipping cost calculations.
  - Implement tax calculation logic.
- **Payment Gateway Integration (Major Feature):**
  - Integrate Stripe or PayPal for actual payment processing.
- **Email Templating:**
  - Use HTML templates (e.g., Handlebars, EJS) for transactional emails.
- **Search API Refinements:**
  - Enhance product search (`GET /api/products`) for better partial match performance (e.g., PostgreSQL full-text search, `pg_trgm`).
- **Input Validation Review:**
  - Systematically review and enhance input validation for all API endpoints using a library like `joi` or `express-validator` (already started using `express-validator`).

### E. Data Seeding
- Enhance `seed.js` to add sample products with variants and reviews. *(Partially DONE - products added, variants/reviews can be next)*

---

## IV. Testing

### A. Backend
- Develop unit tests for services and utility functions.
- Implement integration tests for API endpoints (especially new variant and review APIs).

### B. Frontend
- Write unit tests for Vue components and composables (e.g., using Vitest).
- Implement End-to-End (E2E) tests for critical user flows (registration, login, add to cart with variants, checkout, review submission).

---

## V. Deployment & Operations

- Finalize and document the AWS Amplify deployment strategy.
- Implement database backup and restore procedures.
- Setup monitoring and logging for the production environment.

---
*This list will be updated as features are implemented or new requirements arise.*
