const express = require('express');
const router = express.Router();

router.get('/login', function(req, res) {
    res.render('auth/login');
});

router.get('/signup', function(req, res) {
    res.render('auth/signup');
});

router.get('/forgot-password', function(req, res) {
    res.render('auth/forgot-password');
});

module.exports = router;
