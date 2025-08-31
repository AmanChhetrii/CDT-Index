const express = require('express');
const router = express.Router();

// Protect these routes later with auth middleware
router.get('/dashboard', function(req, res) {
    res.render('dashboard/index');
});

router.get('/dashboard/widgets', function(req, res) {
    res.render('dashboard/widgets');
});

module.exports = router;
