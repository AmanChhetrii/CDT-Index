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

router.get('/analysis', function(req, res) {
    res.render('landing/analysis');
});

module.exports = router;
