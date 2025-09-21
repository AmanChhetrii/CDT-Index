// middleware/auth.js
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user.id);
            if (!user) {
                return req.session.destroy((err) => {
                    if (err) console.error('Session destroy error:', err);
                    res.clearCookie('connect.sid');
                    res.redirect('/login?error=session_expired');
                });
            }
            return next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            return req.session.destroy((err) => {
                if (err) console.error('Session destroy error:', err);
                res.clearCookie('connect.sid');
                res.redirect('/login');
            });
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