// routes/dashboard.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Apply auth middleware to all dashboard routes
router.use(requireAuth);

// Dashboard home
router.get('/dashboard', (req, res) => {
    res.render('dashboard/dashboard', { 
        title: 'Dashboard - CDT Index',
        user: req.session.user,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

// Add more dashboard routes as needed...

module.exports = router;