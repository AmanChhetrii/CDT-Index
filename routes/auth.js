// routes/auth.js
const express = require('express');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { redirectIfAuth } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const router = express.Router();

// Email will be configured inside the route to avoid import issues

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
router.get('/reset-pass', redirectIfAuth, (req, res) => {
    res.render('auth/reset-pass', { 
        title: 'Forgot Password - CDT Index',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// POST - Send OTP for password reset
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Check if user exists
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email address'
            });
        }

        // Check rate limiting
        const rateLimitCheck = await PasswordReset.canRequestOTP(email);
        if (!rateLimitCheck.canRequest) {
            return res.status(429).json({
                success: false,
                message: rateLimitCheck.message
            });
        }

        // Generate OTP and create reset request
        const { otp } = await PasswordReset.createResetRequest(user._id, email);

        // Create email transporter inside the route
        const emailTransporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Send OTP email with CDT Index theme
        // Send OTP email with CDT Index theme
const mailOptions = {
    from: `"CDT Index Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'CDT Index - Password Reset Verification Code',
    html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <!-- Header with gradient background -->
            <div style="background: linear-gradient(135deg, #0a0e34 0%, #260e44 50%, #32002c 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <!-- Logo -->
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; display: inline-block; margin-bottom: 20px;">
                    <h1 style="color: #DAA520; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 2px;">CDT INDEX</h1>
                </div>
                <h2 style="color: white; margin: 0; font-size: 24px; font-weight: 500;">Password Reset Request</h2>
            </div>
            
            <!-- Main content -->
            <div style="padding: 40px 30px; background: #f8f9fa;">
                <h3 style="color: #0a0e34; margin-bottom: 20px; font-size: 20px;">Security Verification Code</h3>
                <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                    We received a request to reset your password for your CDT Index account. 
                    Please use the verification code below to proceed with your password reset:
                </p>
                
                <!-- OTP Code Box -->
                <div style="background: linear-gradient(135deg, #0a0e34 0%, #260e44 100%); 
                            border-radius: 15px; padding: 30px; text-align: center; margin: 30px 0; 
                            box-shadow: 0 8px 25px rgba(10, 14, 52, 0.3);">
                    <p style="color: rgba(255,255,255,0.8); margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                        Your Verification Code
                    </p>
                    <h1 style="color: #DAA520; font-size: 42px; margin: 0; letter-spacing: 8px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                        ${otp}
                    </h1>
                </div>
                
                <!-- Security notice -->
                <div style="background: rgba(218, 165, 32, 0.1); border-left: 4px solid #DAA520; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                    <p style="color: #0a0e34; font-size: 14px; margin: 0; font-weight: 500;">
                        <strong>Important Security Information:</strong>
                    </p>
                    <ul style="color: #555; font-size: 14px; margin: 10px 0 0 0; padding-left: 20px;">
                        <li>This code will expire in <strong>10 minutes</strong></li>
                        <li>Never share this code with anyone</li>
                        <li>If you didn't request this reset, please ignore this email</li>
                    </ul>
                </div>
                
                <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                    If you're having trouble with the password reset process, please contact our support team 
                    or visit our help center for assistance.
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #0a0e34; padding: 25px 30px; text-align: center; border-radius: 0 0 8px 8px;">
                <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 10px 0;">
                    This is an automated security message from CDT Index
                </p>
                <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} CDT Index. All rights reserved.
                </p>
            </div>
        </div>
    `
};

        await emailTransporter.sendMail(mailOptions);

        console.log(`OTP sent to: ${email} - Code: ${otp}`);

        res.json({
            success: true,
            message: 'Verification code sent to your email'
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send verification code. Please try again.'
        });
    }
});

// POST - Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        // Verify OTP
        const verificationResult = await PasswordReset.verifyOTP(email, otp);

        if (verificationResult.success) {
            console.log(`OTP verified successfully for: ${email}`);
            res.json({
                success: true,
                message: verificationResult.message,
                resetRequestId: verificationResult.resetRequestId
            });
        } else {
            res.status(400).json({
                success: false,
                message: verificationResult.message,
                attemptsLeft: verificationResult.attemptsLeft
            });
        }

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify code. Please try again.'
        });
    }
});

// POST - Reset password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, password, resetRequestId } = req.body;

        if (!email || !password || !resetRequestId) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Find the reset request to ensure it's valid
        const resetRequest = await PasswordReset.findById(resetRequestId);
        if (!resetRequest || resetRequest.isUsed || resetRequest.expiresAt < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset request'
            });
        }

        // Find and update user password
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update password (will be automatically hashed by pre-save middleware)
        user.password = password;
        await user.save();

        // Mark reset request as used
        await PasswordReset.markAsUsed(resetRequestId);

        // Clean up old reset requests for this user
        await PasswordReset.cleanupUserRequests(user._id);

        console.log(`Password reset successful for: ${email}`);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password. Please try again.'
        });
    }
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

// GET - Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});
router.get('/logoutt', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/reset-pass');
    });
});

module.exports = router;