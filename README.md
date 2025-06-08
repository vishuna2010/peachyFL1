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

## 6. Frontend Setup

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

## 7. Key Features Implemented

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

## 8. API Endpoint Overview (High-Level)

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

## 9. Deployment

Deployment is planned using AWS Amplify.
-   **Frontend (Nuxt.js):** To be deployed via Amplify Hosting, connecting to the Git repository. Environment variables (like `NUXT_PUBLIC_BACKEND_BASE_URL`) will be set in the Amplify console.
-   **Backend (Node.js/Express):** To be deployed as an AWS Lambda function fronted by Amazon API Gateway. This will likely be defined using Amplify Gen 2's code-first (TypeScript/CDK) approach within an `amplify/` directory (potentially co-located with backend or at project root).
-   **Database:** An external PostgreSQL database (e.g., AWS RDS) will be used, with connection details provided to the backend via environment variables.
-   **File Storage:** AWS S3 is used for product images, configured via backend environment variables and appropriate IAM permissions for the Lambda function.

(Refer to internal research notes for more conceptual deployment details).

## 10. Future Enhancements / To-Do

-   Payment Gateway Integration (Stripe, PayPal, etc.).
-   User Profile Management (frontend UI for users to update their details, view order history, manage 2FA).
-   Full-fledged Customer Order History/Tracking page.
-   Product Variants (e.g., size, color).
-   Customer Reviews & Ratings.
-   Admin Dashboard with key metrics and analytics visualization.
-   Advanced shipping and tax calculation modules.
-   Automated Low Stock Email Alerts & Notifications.
-   Marketing: More advanced Email Campaigns, Referral System.
-   Full implementation of AWS Amplify deployment (creating the `amplify/` backend definition).
-   Comprehensive test suites (unit, integration, e2e).
-   More robust error handling and user feedback across the application.

## 11. Contributing

This project is currently under development by Project JulesBuild. Future contribution guidelines will be established if the project opens to external contributions.
```
