// import express from 'express';
// import { registerUser } from '../controllers/identity-controller.js';
// const router =express.Router()

// router.post('/register' , registerUser)

// export default router


import express from 'express';
import { registerUser , loginUser ,refreshTokenUser , logoutUser} from '../controllers/identity-controller.js';
const router = express.Router();

// Handle POST /api/auth/register
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh-token', refreshTokenUser);
router.post('/logout', logoutUser);

// Handle malformed URLs with %0A (newline)
router.post('/register%0A', (req, res) => {
  // Redirect to the correct endpoint or handle it
  res.redirect(308, '/api/auth/register');
});

// Handle malformed URLs with %0A (newline)
router.post('/login%0A', (req, res) => {
  // Redirect to the correct endpoint or handle it
  res.redirect(308, '/api/auth/login');
});
// Handle malformed URLs with %0A (newline)
router.post('/refresh-token%0A', (req, res) => {
  // Redirect to the correct endpoint or handle it
  res.redirect(308, '/api/auth/refresh-token');
});
// Handle malformed URLs with %0A (newline)
router.post('/logout%0A', (req, res) => {
  // Redirect to the correct endpoint or handle it
  res.redirect(308, '/api/auth/logout');
});

// Add GET handler to prevent "Cannot GET" errors
router.get('/register', (req, res) => {
  res.status(405).json({ 
    success: false, 
    message: 'Method Not Allowed. Use POST for registration.' 
  });
});

router.get('/login', (req, res) => {
  res.status(405).json({ 
    success: false, 
    message: 'Method Not Allowed. Use POST for login.' 
  });
});
router.get('/refresh-token', (req, res) => {
  res.status(405).json({ 
    success: false, 
    message: 'Method Not Allowed. Use POST for refresh-token.' 
  });
});
router.get('/logout', (req, res) => {
  res.status(405).json({ 
    success: false, 
    message: 'Method Not Allowed. Use POST for logout.' 
  });
});

export default router;
