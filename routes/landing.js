const express = require('express');
const router = express.Router();

router.get('/', function(req, res) {
    res.render('landing/index');
});

router.get('/about-us', function(req, res) {
    res.render('landing/about-us');
});

router.get('/faq', function(req, res) {
    res.render('landing/faq');
});

router.get('/services', function(req, res) {
    res.render('landing/services');
});

router.get('/policy', function(req, res) {
    res.render('landing/policy');
});

router.get('/funds', function(req, res) {
    res.render('landing/funds');
});

module.exports = router;
