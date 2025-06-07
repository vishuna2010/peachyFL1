const express = require('express');
const cors = require('cors'); // Import CORS
const auth = require('./auth'); // Import the auth module
const db = require('./db'); // Import the db module to ensure tables are created
const productRoutes = require('./routes/products'); // Import product routes

const app = express();
const port = 3000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies

// API Health Check or Info
app.get('/api', (req, res) => {
  res.send('Hello World! Welcome to the E-commerce API. All routes are under /api.');
});

// --- Authentication Routes ---
const authRouter = express.Router();

// Register
authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const result = await auth.registerUser(email, password);
  if (result.success) {
    // Exclude password from the response if user object is sent
    // Ensure result.user is defined before destructuring
    const userResponse = result.user ? (({ password, ...rest }) => rest)(result.user) : {};
    res.status(201).json({ message: 'User registered successfully.', user: userResponse });
  } else {
    res.status(400).json({ message: result.message });
  }
});

// Login
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const result = await auth.loginUser(email, password);
  if (result.success) {
    res.status(200).json({ message: 'Login successful.', token: result.token });
  } else {
    res.status(401).json({ message: result.message });
  }
});

// Request Password Reset
authRouter.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  const result = await auth.requestPasswordReset(email);
  res.status(200).json({ message: result.message });
});

// Reset Password
authRouter.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }
  const result = await auth.resetPassword(token, newPassword);
  res.status(200).json({ message: result.message });
});

app.use('/api/auth', authRouter); // Mount auth router under /api/auth

// --- Product Routes ---
app.use('/api/products', productRoutes); // Mount product routes under /api/products


// Ensure DB connection is attempted and tables are created when server starts
// The db.js file already tries to connect and create tables upon import.
// If db.pool is not undefined, we can assume it's trying to connect.
if (db.pool) {
  console.log('Database module loaded, connection and table creation initiated.');
}


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
