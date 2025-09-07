
// Check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    } else {
        req.flash('error', 'Please log in to access this page');
        return res.redirect('/auth/login');
    }
};

// Redirect authenticated users (for login/signup pages)
const redirectIfAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return res.redirect('/dashboard');
    }
    next();
};

module.exports = {
    requireAuth,
    redirectIfAuth
};