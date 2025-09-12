// routes/dashboard.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
// Import required models
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Fund = require('../models/Fund');
const NAV = require('../models/NAV');

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

router.get('/dashboard/widgets', (req, res) => {
    res.render('dashboard/widgets');
});

router.get('/dashboard/transactions', (req, res) => {
    res.render('dashboard/transactions');
});




module.exports = router;