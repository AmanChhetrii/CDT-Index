const express = require('express');
const router = express.Router();
const Fund = require('../models/Fund');
const NAV = require('../models/NAV');

router.get('/', function(req, res) {
    res.render('landing/index');
});

router.get('/about-us', function(req, res) {
    res.render('landing/about-us');
});

router.get('/faq', function(req, res) {
    res.render('landing/faq');
});

// Updated services route to fetch fund data from database with real NAV
router.get('/services', async function(req, res) {
    try {
        // Fetch all active funds sorted by display order
        const funds = await Fund.getActiveFunds();
        
        // Add current NAV data to each fund
        for (let fund of funds) {
            const latestNAV = await NAV.getLatestNAV(fund.symbol);
            fund.currentNAVFromDB = latestNAV ? latestNAV.nav : fund.currentNAV;
            fund.totalReturnFromDB = latestNAV ? latestNAV.totalReturnPercent : 0;
        }
        
        // Pass funds data to the template
        res.render('landing/services', { 
            funds: funds,
            error: null 
        });
    } catch (error) {
        console.error('Error fetching funds for services page:', error);
        
        // Render with empty funds array and error message
        res.render('landing/services', { 
            funds: [],
            error: 'Unable to load fund data at this time.' 
        });
    }
});

router.get('/policy', function(req, res) {
    res.render('landing/policy');
});

router.get('/funds', function(req, res) {
    res.render('landing/funds');
});

module.exports = router;