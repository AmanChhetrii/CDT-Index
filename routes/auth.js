// routes/auth.js
const express = require('express');
const User = require('../models/User');
const { redirectIfAuth } = require('../middleware/auth');
const router = express.Router();

// GET - Login page
router.get('/login', redirectIfAuth, (req, res) => {
    res.render('auth/login', { 
        title: 'Login - CDT Index',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// GET - Signup page
router.get('/signup', redirectIfAuth, (req, res) => {
    res.render('auth/signup', { 
        title: 'Sign Up - CDT Index',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// POST - Signup
router.post('/signup', redirectIfAuth, async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword } = req.body;

        // Basic validation
        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            req.flash('error', 'All fields are required');
            return res.redirect('/signup');
        }

        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match');
            return res.redirect('/signup');
        }

        if (password.length < 8) {
            req.flash('error', 'Password must be at least 8 characters');
            return res.redirect('/signup');
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            req.flash('error', 'Email already registered');
            return res.redirect('/signup');
        }

        // Create new user
        const user = new User({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password
        });

        await user.save();

        req.flash('success', 'Account created successfully! Please log in.');
        res.redirect('/login');

    } catch (error) {
        console.error('Signup error:', error);
        req.flash('error', 'An error occurred during signup');
        res.redirect('/signup');
    }
});

// GET - Forgot Password page
router.get('/forgot-password', redirectIfAuth, (req, res) => {
    res.render('auth/forgot-password', { 
        title: 'Forgot Password - CDT Index',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// POST - Login
router.post('/login', redirectIfAuth, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            req.flash('error', 'Please provide email and password');
            return res.redirect('/login');
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }

        // Create session
        req.session.userId = user._id;
        req.session.user = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            fullName: user.fullName
        };

        req.flash('success', `Welcome back, ${user.firstName}!`);
        res.redirect('/dashboard');

    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'An error occurred during login');
        res.redirect('/login');
    }
});

// POST - Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;