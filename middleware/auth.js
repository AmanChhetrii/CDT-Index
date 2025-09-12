// middleware/auth.js
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
    if (req.session.user) {
        // Verify user still exists in database
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                // User deleted - destroy session
                req.session.destroy();
                req.flash('error', 'Session expired. Please log in again.');
                return res.redirect('/login');
            }
            return next();
        } catch (error) {
            req.session.destroy();
            return res.redirect('/login');
        }
    }
    res.redirect('/login');
};

const redirectIfAuth = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    next();
};

module.exports = { requireAuth, redirectIfAuth };