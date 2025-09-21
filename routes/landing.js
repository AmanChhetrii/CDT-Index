const express = require('express');
const router = express.Router();
const Fund = require('../models/Fund');
const NAV = require('../models/NAV');
const Contact = require('../models/Contact'); // Add this line

// Landing pages
router.get('/', function(req, res) {
    res.render('landing/index');
});

router.get('/about-us', function(req, res) {
    res.render('landing/about-us');
});

router.get('/faq', function(req, res) {
    res.render('landing/faq');
});

router.get('/policy', function(req, res) {
    res.render('landing/policy');
});

// Services route with fund data
router.get('/services', async function(req, res) {
    try {
        const funds = await Fund.getActiveFunds();
        
        const fundsWithNAV = await Promise.all(funds.map(async (fund) => {
            try {
                const latestNAV = await NAV.getLatestNAV(fund.symbol);
                fund.currentNAVFromDB = latestNAV ? latestNAV.nav : fund.currentNAV;
                fund.totalReturnFromDB = latestNAV ? latestNAV.totalReturnPercent : 0;
                return fund;
            } catch (error) {
                console.error(`NAV fetch error for ${fund.symbol}:`, error);
                fund.currentNAVFromDB = fund.currentNAV;
                fund.totalReturnFromDB = 0;
                return fund;
            }
        }));
        
        res.render('landing/services', { 
            funds: fundsWithNAV,
            error: null 
        });
    } catch (error) {
        console.error('Services page error:', error);
        res.render('landing/services', { 
            funds: [],
            error: 'Unable to load fund data at this time.' 
        });
    }
});

// Funds landing page
router.get('/funds', function(req, res) {
    res.render('landing/funds');
});

// Contact Form Submission (AJAX endpoint)
router.post('/api/contact', async function(req, res) {
    try {
        const { name, email, subject, message } = req.body;

        // Basic validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Email validation
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Create new contact message
        const newContact = new Contact({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            subject: subject.trim(),
            message: message.trim(),
            ipAddress: req.ip || req.connection.remoteAddress
        });

        // Save to database
        await newContact.save();

        console.log(`New contact message from: ${email} - ${subject}`);

        // Success response
        res.json({
            success: true,
            message: 'Thank you for your message! We will get back to you within 24-48 hours.'
        });

    } catch (error) {
        console.error('Contact form error:', error);

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: errorMessages.join('. ')
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again later.'
        });
    }
});

// Admin route to view contact messages (optional)
router.get('/admin/contacts', async function(req, res) {
    try {
        // Add authentication middleware here if needed
        const contacts = await Contact.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .select('name email subject message status createdAt');
            
        res.json({
            success: true,
            count: contacts.length,
            contacts: contacts
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch contacts' 
        });
    }
});

// API Routes for Funds

// Get all funds with current NAV data
router.get('/api/funds', async function(req, res) {
    try {
        const funds = await Fund.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
        
        if (!funds || funds.length === 0) {
            return res.json([]);
        }
        
        const fundsWithPerformance = await Promise.all(funds.map(async (fund) => {
            try {
                const performanceSummary = await NAV.getPerformanceSummary(fund.symbol);
                
                return {
                    _id: fund._id,
                    name: fund.name,
                    symbol: fund.symbol,
                    slug: fund.slug,
                    summary: fund.summary,
                    description: fund.description,
                    riskLevel: fund.riskLevel,
                    riskIcon: fund.riskIcon,
                    composition: fund.composition,
                    currentNAV: performanceSummary.currentNAV || fund.currentNAV,
                    inceptionNAV: fund.inceptionNAV,
                    inceptionDate: fund.inceptionDate,
                    totalReturn: performanceSummary.totalReturnPercent || 0,
                    dailyChange: performanceSummary.dailyChange || 0,
                    dailyChangePercent: performanceSummary.dailyChangePercent || 0,
                    lastUpdated: performanceSummary.lastUpdated,
                    isActive: fund.isActive,
                    featured: fund.featured,
                    displayOrder: fund.displayOrder
                };
            } catch (navError) {
                console.error(`Performance data error for ${fund.symbol}:`, navError);
                
                return {
                    _id: fund._id,
                    name: fund.name,
                    symbol: fund.symbol,
                    slug: fund.slug,
                    summary: fund.summary,
                    description: fund.description,
                    riskLevel: fund.riskLevel,
                    riskIcon: fund.riskIcon,
                    composition: fund.composition,
                    currentNAV: fund.currentNAV,
                    inceptionNAV: fund.inceptionNAV,
                    inceptionDate: fund.inceptionDate,
                    totalReturn: 0,
                    dailyChange: 0,
                    dailyChangePercent: 0,
                    lastUpdated: null,
                    isActive: fund.isActive,
                    featured: fund.featured,
                    displayOrder: fund.displayOrder
                };
            }
        }));
        
        res.json(fundsWithPerformance);
        
    } catch (error) {
        console.error('API funds error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch funds data',
            message: 'Database connection error' 
        });
    }
});

// Get specific fund details
router.get('/api/funds/:symbol', async function(req, res) {
    try {
        const fundSymbol = req.params.symbol.toUpperCase().trim();
        
        if (!fundSymbol || fundSymbol.length > 10) {
            return res.status(400).json({ error: 'Invalid fund symbol' });
        }
        
        const fund = await Fund.findOne({ 
            symbol: fundSymbol, 
            isActive: true 
        });
        
        if (!fund) {
            return res.status(404).json({ error: 'Fund not found' });
        }
        
        const performanceSummary = await NAV.getPerformanceSummary(fundSymbol);
        
        const fundData = {
            _id: fund._id,
            name: fund.name,
            symbol: fund.symbol,
            slug: fund.slug,
            summary: fund.summary,
            description: fund.description,
            riskLevel: fund.riskLevel,
            riskIcon: fund.riskIcon,
            composition: fund.composition,
            currentNAV: performanceSummary.currentNAV || fund.currentNAV,
            inceptionNAV: fund.inceptionNAV,
            inceptionDate: fund.inceptionDate,
            totalReturn: performanceSummary.totalReturnPercent || 0,
            dailyChange: performanceSummary.dailyChange || 0,
            dailyChangePercent: performanceSummary.dailyChangePercent || 0,
            lastUpdated: performanceSummary.lastUpdated,
            isActive: fund.isActive,
            featured: fund.featured,
            displayOrder: fund.displayOrder
        };
        
        res.json(fundData);
        
    } catch (error) {
        console.error('API fund details error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch fund details',
            message: 'Server error' 
        });
    }
});

// Get fund NAV history for charts
router.get('/api/funds/:symbol/nav', async function(req, res) {
    try {
        const fundSymbol = req.params.symbol.toUpperCase().trim();
        const timeframe = req.query.timeframe || '1M';
        
        // Validate inputs
        const validTimeframes = ['1M', '6M', '1Y', '5Y', 'ALL'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({ error: 'Invalid timeframe. Use: 1M, 6M, 1Y, 5Y, or ALL' });
        }
        
        if (!fundSymbol || fundSymbol.length > 10) {
            return res.status(400).json({ error: 'Invalid fund symbol' });
        }
        
        // Check if fund exists
        const fundExists = await Fund.findOne({ 
            symbol: fundSymbol, 
            isActive: true 
        });
        
        if (!fundExists) {
            return res.status(404).json({ error: 'Fund not found' });
        }
        
        // Get chart data
        const chartData = await NAV.getChartData(fundSymbol, timeframe);
        
        if (!chartData || chartData.length === 0) {
            return res.json([]);
        }
        
        // Format data for frontend
        const formattedData = chartData.map(item => ({
            date: item.date,
            nav: parseFloat(item.nav.toFixed(4)),
            dailyChangePercent: parseFloat((item.dailyChangePercent || 0).toFixed(2)),
            totalReturnPercent: parseFloat((item.totalReturnPercent || 0).toFixed(2))
        }));
        
        res.json(formattedData);
        
    } catch (error) {
        console.error('API NAV history error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch NAV history',
            message: 'Chart data unavailable' 
        });
    }
});

// Get performance comparison data
router.get('/api/performance', async function(req, res) {
    try {
        const funds = await Fund.find({ isActive: true }).sort({ displayOrder: 1 });
        
        if (!funds || funds.length === 0) {
            return res.json([]);
        }
        
        const performanceData = await Promise.all(funds.map(async (fund) => {
            try {
                const summary = await NAV.getPerformanceSummary(fund.symbol);
                
                return {
                    symbol: fund.symbol,
                    name: fund.name,
                    currentNAV: parseFloat((summary.currentNAV || fund.currentNAV).toFixed(4)),
                    totalReturn: parseFloat((summary.totalReturnPercent || 0).toFixed(2)),
                    dailyChange: parseFloat((summary.dailyChangePercent || 0).toFixed(2)),
                    riskLevel: fund.riskLevel,
                    lastUpdated: summary.lastUpdated
                };
            } catch (error) {
                console.error(`Performance error for ${fund.symbol}:`, error);
                return {
                    symbol: fund.symbol,
                    name: fund.name,
                    currentNAV: parseFloat(fund.currentNAV.toFixed(4)),
                    totalReturn: 0,
                    dailyChange: 0,
                    riskLevel: fund.riskLevel,
                    lastUpdated: null
                };
            }
        }));
        
        res.json(performanceData);
        
    } catch (error) {
        console.error('API performance error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch performance data',
            message: 'Performance data unavailable' 
        });
    }
});

module.exports = router;