```markdown
# E-Commerce Platform (Project JulesBuild)

## 1. Overview

This project is a comprehensive e-commerce platform featuring a public-facing storefront built with Nuxt.js and a robust backend API powered by Node.js and Express.js, using PostgreSQL as the database. It includes features like user authentication with 2FA, product catalog management, a shopping cart, checkout process, order management, discount codes, basic inventory tracking with purchase orders, supplier management, AWS S3 integration for product images, PDF product label generation, and an admin panel for site administration and reporting.

## 2. Tech Stack

**Frontend:**
- Nuxt.js 3 (Vue.js Framework)
- State Management: Nuxt Composables (`useState`, `ref`, `computed` - similar pattern to Pinia stores)
- Axios (HTTP Client)
- Tailwind CSS (Note: Base Nuxt styling is used; a full framework like Tailwind CSS is not explicitly integrated project-wide by default, but can be added by the user)
- `qrcode` (for 2FA QR code generation)

**Backend:**
- Node.js
- Express.js
- PostgreSQL (Database)
- `pg` (Node.js PostgreSQL client)
- `jsonwebtoken` (for JWT authentication)
- `bcrypt` (for password hashing)
- `otplib` (for 2FA TOTP)
- `nodemailer` (for email sending, using Ethereal.email for testing)
- `aws-sdk` (for AWS S3 integration)
- `multer` (for file upload handling)
- `puppeteer`, `jsbarcode`, `canvas` (for PDF product label generation with barcodes)
- `dotenv` (for managing environment variables in local development)

**File Storage:**
- AWS S3 (for product images)

## 3. Project Structure

The project is organized into two main directories at the root:

- `/frontend`: Contains the Nuxt.js application for the customer-facing website and admin panel UI.
- `/backend`: Contains the Node.js/Express.js API server and database interaction logic.

Each directory has its own `package.json` and dependencies.

## 4. Prerequisites

- Node.js (v18.x or later recommended)
- npm (v8.x or later) or yarn
- Git (for version control and cloning)
- PostgreSQL server (running locally or accessible)
- A PostgreSQL client tool (e.g., `psql`, pgAdmin) for database setup and inspection.
- (Optional) AWS Account and S3 bucket for image uploads if testing S3 integration.
- (Optional) An authenticator app (e.g., Google Authenticator, Authy) for testing 2FA.

## 5. Backend Setup

1.  **Navigate to Backend Directory:**
    `cd backend`
2.  **Install Dependencies:**
    `npm install`
3.  **Database Setup:**
    *   Ensure your PostgreSQL server is running.
    *   Create a new PostgreSQL database (e.g., `my_ecommerce_db`).
    *   The backend application, upon starting, will attempt to create necessary tables if they don't already exist (due to `CREATE TABLE IF NOT EXISTS ...` statements in `backend/db.js`). For manual control or initial setup in specific environments, you can extract the SQL statements from `backend/db.js` and execute them using a PostgreSQL client.
4.  **Environment Variables:**
    *   In the `backend/` directory, copy the `backend/.env.example` template to a new file named `backend/.env`.
    *   Update the following environment variables in `backend/.env`, replacing placeholder values:
        ```dotenv
        # Database Connection (PostgreSQL)
        DATABASE_URL=postgresql://your_db_user:your_db_password@your_db_host:5432/your_db_name

        # Server Configuration
        PORT=3000 # Or your preferred port for the backend
        NODE_ENV=development # Or 'production'

        # JWT Authentication
        JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars_long

        # AWS S3 for Image Uploads (Optional: Leave blank if not testing S3)
        # AWS_ACCESS_KEY_ID=your_aws_access_key_id
        # AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
        # AWS_S3_BUCKET_NAME=your_s3_bucket_name
        # AWS_REGION=your_aws_s3_bucket_region

        # Email Service (Ethereal.email test account used by default if real SMTP is not set)
        # For production, configure a real SMTP provider or email service:
        # SMTP_HOST=your_smtp_host
        # SMTP_PORT=your_smtp_port
        # SMTP_USER=your_smtp_user
        # SMTP_PASS=your_smtp_password
        # SMTP_SECURE=true # Typically 'true' for port 465, 'false' for 587 (STARTTLS)
        # SENDER_EMAIL_ADDRESS="My Awesome E-Commerce <noreply@example.com>"

        # Application Name (used in 2FA OTPAuth URL & Email Subjects)
        # APP_NAME="My Awesome E-Commerce"
        ```
5.  **Run the Backend Server:**
    `npm start`
    The API server should now be running (e.g., on `http://localhost:3000`).
6.  **Seed Initial Data (Optional but Recommended for Development):**
    *   After setting up your `.env` file and ensuring your database is accessible, you can run the seed script to populate the database with initial data.
    *   This script will:
        *   Create a default admin user. Credentials (from `.env` or defaults):
            *   Email: `admin@example.com` (or value of `ADMIN_EMAIL` in `.env`)
            *   Password: `admin123` (or value of `ADMIN_PASSWORD` in `.env`)
        *   Create a set of sample product categories.
    *   To run the seed script, navigate to the `backend` directory and run:
        ```bash
        npm run seed
        ```
    *   The script is designed to be run multiple times safely (it won't duplicate users or categories with the same unique keys).

## 7. Frontend Setup

1.  **Navigate to Frontend Directory:**
    `cd frontend` (from the project root)
2.  **Install Dependencies:**
    `npm install`
3.  **Environment Variables:**
    *   In the `frontend/` directory, create a `.env` file.
    *   Add the following environment variable:
        ```dotenv
        NUXT_PUBLIC_BACKEND_BASE_URL=http://localhost:3000
        ```
        This URL should point to your running backend API. The `/api` path segment (e.g. for `/api/products`) is handled by the Axios `baseURL` configuration in `frontend/plugins/axios.js`, which uses this base URL.
4.  **Run the Frontend Development Server:**
    `npm run dev`
    The Nuxt.js frontend should now be running (e.g., on `http://localhost:3001` or another port shown in the console).

## 8. Key Features Implemented

*   **User Authentication:** Registration, Login (JWT-based), Password Hashing (bcrypt), Two-Factor Authentication (TOTP setup & login), Password Recovery (conceptual backend, email via Ethereal).
*   **Product Catalog:** Listing with dynamic search, filtering (category, price range), and sorting. Product detail pages. Product image hosting on AWS S3.
*   **Shopping Cart & Checkout:** Full client-side cart functionality (add, update, remove, clear), persistence via localStorage, discount code application (client-side validation via API), checkout process with address forms, and order creation.
*   **Discount Codes:** Application of discount codes to the cart, validated by the backend.
*   **Admin Panel Modules:**
    *   **Order Management:** View list of all customer orders (paginated), view detailed order information, update order status.
    *   **Inventory Management:**
        *   Product stock quantity tracking (viewable, updated on order/PO receiving).
        *   Supplier CRUD operations.
        *   Linking products to suppliers during product creation/editing.
        *   Purchase Order (PO) management: Create POs with line items, list POs, view PO details, update PO header/status.
        *   Receiving stock against PO line items (updates product stock and PO item received quantity).
        *   Product reorder thresholds (settable per product).
    *   **User Management:** List users, view user details, update user roles, delete users.
    *   **Product Management (Admin Protected):** Create, Read (via public API), Update, Delete products. This includes management of product name, description, price, stock, images (S3), category (implicit via `categories` table), tags (implicit via `tags` and `product_tags` tables), supplier, SKU, and reorder threshold.
    *   **Discount Code Management:** Full CRUD operations for discount codes.
    *   **Supplier Management:** Full CRUD operations for suppliers.
    *   **Reporting:**
        *   Low Stock Report (products at or below reorder threshold).
        *   Sales Report (by date range, showing summary and individual orders).
        *   Best Sellers Report (by quantity or revenue, with optional date range).
*   **Transactional Emails:** Order confirmation emails sent via Nodemailer (using Ethereal.email for development/testing).
*   **PDF Generation:** Product labels including name, SKU, price, and a Code128 barcode.

## 9. API Endpoint Overview (High-Level)

### Public Routes (Accessible by anyone):
-   `/api/auth/register` (POST)
-   `/api/auth/login` (POST - step 1 for 2FA if enabled)
-   `/api/auth/request-password-reset` (POST)
-   `/api/auth/reset-password` (POST)
-   `/api/auth/2fa/login-verify` (POST - step 2 for 2FA login)
-   `/api/products` (GET - list, search, filter, sort)
-   `/api/products/:id` (GET - single product)
-   `/api/categories` (GET - list categories)
-   `/api/cart/validate-discount` (POST - validate discount code against cart subtotal)

### Authenticated User Routes (Require valid JWT, any role):
-   `/api/orders` (POST - create orders)
-   `/api/auth/2fa/setup` (POST - initiate 2FA setup)
-   `/api/auth/2fa/verify` (POST - verify and enable 2FA)
-   *(User profile management routes, e.g., for updating own profile, would be added here)*

### Admin Routes (Require admin role via JWT):
-   `/api/products` (POST - create product; admin protected route in `routes/products.js`)
-   `/api/products/:id` (PUT, DELETE - update/delete product; admin protected routes in `routes/products.js`)
-   `/api/admin/products/:id/stock` (PUT - specific admin action for stock adjustment)
-   `/api/admin/products/:id/label` (GET - generate product label PDF)
-   `/api/admin/users` (GET, GET /:id)
-   `/api/admin/users/:id/role` (PUT)
-   `/api/admin/users/:id` (DELETE)
-   `/api/admin/orders` (GET - list all orders)
-   `/api/admin/orders/:id` (GET - view specific order)
-   `/api/admin/orders/:id/status` (PUT - update order status)
-   `/api/admin/purchase-orders` (POST, GET, GET /:id, PUT /:id)
-   `/api/admin/purchase-orders/:poId/items/:poItemId/receive` (POST - receive stock for a PO item)
-   `/api/admin/discounts` (POST, GET, GET /:id, PUT /:id, DELETE /:id)
-   `/api/admin/suppliers` (POST, GET, GET /:id, PUT /:id, DELETE /:id)
-   `/api/admin/reports/low-stock-products` (GET)
-   `/api/admin/reports/sales` (GET)
-   `/api/admin/reports/best-sellers` (GET)

*(This is a summary; actual route definitions and parameter details are in the `backend/routes/` subdirectories.)*

## 10. Deployment

Deployment is planned using AWS Amplify.
-   **Frontend (Nuxt.js):** To be deployed via Amplify Hosting, connecting to the Git repository. Environment variables (like `NUXT_PUBLIC_BACKEND_BASE_URL`) will be set in the Amplify console.
-   **Backend (Node.js/Express):** To be deployed as an AWS Lambda function fronted by Amazon API Gateway. This will likely be defined using Amplify Gen 2's code-first (TypeScript/CDK) approach within an `amplify/` directory (potentially co-located with backend or at project root).
-   **Database:** An external PostgreSQL database (e.g., AWS RDS) will be used, with connection details provided to the backend via environment variables.
-   **File Storage:** AWS S3 is used for product images, configured via backend environment variables and appropriate IAM permissions for the Lambda function.

(Refer to internal research notes for more conceptual deployment details).

## 11. Future Enhancements / To-Do

This list outlines pending tasks and potential future features for the platform, categorized for clarity.

### High Priority / Near-Term
- **Frontend - Core User Features:**
  - Connect "My Orders" list page (`pages/profile/orders.vue`) to the backend API.
  - Connect "Order Detail" page (`pages/profile/orders/[id].vue`) to the backend API.
  - Implement "Change Password" functionality:
    - Backend: Create API endpoint for changing password.
    - Frontend: Connect `profile.vue` form to the new endpoint.
  - Implement "Update Profile Details" (e.g., user's name):
    - Backend: Potentially add new fields to user model; create API endpoint.
    - Frontend: Add form to `profile.vue` and connect to API.
- **Backend - Core User Features:**
  - Create API endpoint for "Change Password".
  - Define updatable "Profile Details" and create corresponding API endpoint(s).
- **Data Seeding:**
  - Enhance `seed.js` to add sample products (including relations to categories, suppliers).

### Frontend - UI/UX Enhancements
- **Product Listing Page (`pages/index.vue`):**
  - **Advanced Filters UI (Phase 2+):**
    - Implement collapsible sidebar for filters on desktop.
    - Implement modal/drawer for filters on mobile.
    - Add visual filters (e.g., color swatches).
    - Implement a price range slider.
- **Product Detail Page (`pages/products/[id].vue`):**
  - **Image Gallery Phase 2:** Implement click-to-zoom on main image, improve thumbnail interactions (e.g., scrolling for many images).
  - **Variant Selector Refinement:** Display visual swatches for "Color" options; ensure "Size" or other options are clear and possibly indicate stock per selection.
  - **Product Information Tabs:** For organizing description, specifications, reviews, shipping info.
- **General UI Polish:**
  - **Interactive Feedback (Phase 2+):**
    - Implement Skeleton Loaders for PLP, PDP, Order History during data fetching.
    - Refine Toast Notification usage/styling if needed.
  - **Global Typography:** Further review and refine typographic scale, line heights, letter spacing with the Poppins font.
  - **Login/Registration Pages:** Style `pages/login.vue` and `pages/register.vue` with Tailwind CSS.
- **Empty States & Error Pages:**
  - Design more engaging and helpful empty state components throughout the application.
  - Ensure the custom 404 page (`error.vue`) is robust and potentially add more specific error pages if needed.

### Frontend - Admin UI/UX (Continuing "Robotech" Inspiration)
- **Admin Dashboard (`pages/admin/index.vue`):**
  - Implement actual data fetching for Stat Cards.
  - Integrate basic charts (e.g., sales over time - requires backend data source).
  - Implement "Recent Activity" and "Recent Orders Table" sections with real data.
- **Styling Core Admin Pages:**
  - Refactor key admin pages (e.g., `admin/users/index.vue`, `admin/products/index.vue`, `admin/products/new.vue`, `admin/orders/index.vue`, etc.) to use Tailwind CSS for tables, forms, buttons, pagination, aligning with the Robotech style.
  - Create reusable admin-specific form components if beneficial.
- **Admin Layout Refinements:**
  - Add SVG icons to all `AdminSidebar.vue` navigation items.
  - Implement a functional global search bar in the top admin bar.
  - Add notification icon/dropdown placeholder in top admin bar.
  - Consider more sophisticated collapse mechanism for the sidebar (e.g., icon-only view).
- **Admin - Missing Index Pages:**
  - Create `frontend/pages/admin/categories/index.vue` (for listing/managing categories).
  - Create `frontend/pages/admin/reports/index.vue` (as a dashboard for reports).
- **Breadcrumbs:** Implement breadcrumb navigation within the admin section.

### Backend - Enhancements & New Features
- **Product Variants:**
  - Full backend logic for creating, updating, and managing product variants with different options (size, color, etc.).
  - Ensure variants correctly impact SKU, price, and stock quantity.
  - API endpoints for managing options and variants associated with products.
- **Customer Reviews & Ratings:**
  - API endpoints for submitting product reviews (requires user authentication).
  - API endpoints for retrieving (paginated) reviews for a product.
  - Logic for calculating average ratings.
- **Advanced Shipping & Tax Calculation:**
  - Develop or integrate modules for more complex shipping cost calculations (e.g., based on weight, destination, provider APIs).
  - Implement tax calculation logic based on region or product type.
- **Payment Gateway Integration:**
  - Integrate a payment provider like Stripe or PayPal for actual payment processing. This is a major feature involving frontend and backend.
- **Email Templating:**
  - Use HTML templates (e.g., with a library like Handlebars or EJS) for more professional and brandable transactional emails (order confirmation, password reset, etc.).
- **Search API Refinements:**
  - Enhance the product search functionality on `GET /api/products` for better partial match performance (e.g., using PostgreSQL's full-text search capabilities or `pg_trgm` for trigram similarity).
- **Input Validation:**
  - Systematically review and enhance input validation for all API endpoints using a library like `joi` or `express-validator`.

### Testing
- **Backend:**
  - Develop unit tests for services and utility functions.
  - Implement integration tests for API endpoints.
- **Frontend:**
  - Write unit tests for Vue components and composables (e.g., using Vitest).
  - Implement End-to-End (E2E) tests for critical user flows (e.g., registration, login, add to cart, checkout).

### Deployment & Operations
- Finalize and document the AWS Amplify deployment strategy.
- Implement database backup and restore procedures.
- Setup monitoring and logging for the production environment.

## 12. Contributing

This project is currently under development by Project JulesBuild. Future contribution guidelines will be established if the project opens to external contributions.
```
