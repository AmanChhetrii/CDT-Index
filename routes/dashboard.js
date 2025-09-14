// routes/dashboard.js - Clean routes with service separation
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Import services
const FundService = require('../services/fundService');
const ChartService = require('../services/chartService');
const WalletService = require('../services/walletService');
const SubscriptionService = require('../services/subscriptionService');
const InvestmentService = require('../services/investmentService');

// Apply auth middleware to all dashboard routes
router.use(requireAuth);

// ===== PAGE ROUTES =====

router.get('/dashboard', (req, res) => {
    res.render('dashboard/dashboard', { 
        title: 'Dashboard - CDT Index',
        user: req.session.user,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/widgets', (req, res) => {
    res.render('dashboard/widgets');
});

router.get('/dashboard/premium', (req, res) => {
    res.render('dashboard/premium', {
        title: 'Premium Plans - CDT Index',
        user: req.session.user,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/transactions', (req, res) => {
    res.render('dashboard/transactions');
});

router.get('/dashboard/wallet', (req, res) => {
    res.render('dashboard/wallet', {
        title: 'Wallet - CDT Index',
        user: req.session.user,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/explore', (req, res) => {
    res.render('dashboard/explore', {
        title: 'Explore Funds - CDT Index',
        user: req.session.user,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

// Buy page route with fund data
router.get('/dashboard/buy/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        
        // Get fund details and user portfolio
        const [fundDetails, userPortfolio] = await Promise.all([
            FundService.getFundDetails(symbol.toUpperCase()),
            WalletService.getUserPortfolio(req.session.user.id)
        ]);
        
        res.render('dashboard/buy', {
            title: `Buy ${fundDetails.name} - CDT Index`,
            fund: fundDetails,
            userPortfolio: userPortfolio,
            user: req.session.user,
            success: req.flash('success'),
            error: req.flash('error')
        });
        
    } catch (error) {
        console.error('Buy page error:', error);
        req.flash('error', 'Fund not found or unable to load fund data');
        res.redirect('/dashboard/explore');
    }
});
// ===== FUND API ENDPOINTS =====

router.get('/api/funds', async (req, res) => {
    try {
        const funds = await FundService.getAllActiveFunds();
        res.json(funds);
    } catch (error) {
        console.error('API funds error:', error);
        res.status(500).json({ 
            error: 'Unable to load funds data',
            message: error.message
        });
    }
});

router.get('/api/fund-details/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const fundDetails = await FundService.getFundDetails(symbol);
        res.json(fundDetails);
    } catch (error) {
        console.error('API fund details error:', error);
        if (error.message.includes('Fund not found')) {
            return res.status(404).json({ error: 'Fund not found' });
        }
        res.status(500).json({ error: 'Unable to load fund details' });
    }
});

router.get('/api/nav-chart/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const timeframe = req.query.timeframe || '1M';
        const chartData = await ChartService.getFundChartData(symbol, timeframe);
        res.json(chartData);
    } catch (error) {
        console.error('API chart error:', error);
        res.status(500).json({ error: 'Unable to load chart data' });
    }
});

router.get('/api/fund-performance/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const performance = await FundService.getFundPerformance(symbol);
        res.json(performance);
    } catch (error) {
        console.error('API fund performance error:', error);
        res.status(500).json({ error: 'Unable to load fund performance' });
    }
});

router.get('/api/supported-timeframes', (req, res) => {
    try {
        const timeframes = ChartService.getSupportedTimeframes();
        res.json(timeframes);
    } catch (error) {
        res.status(500).json({ error: 'Unable to load supported timeframes' });
    }
});

// ===== WALLET API ENDPOINTS =====

router.get('/api/wallet/portfolio', async (req, res) => {
    try {
        const portfolio = await WalletService.getUserPortfolio(req.session.user.id);
        res.json(portfolio);
    } catch (error) {
        console.error('API wallet portfolio error:', error);
        res.status(500).json({ error: 'Unable to load portfolio data' });
    }
});

router.get('/api/wallet/transactions', async (req, res) => {
    try {
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            type: req.query.type
        };
        const transactions = await WalletService.getUserTransactions(req.session.user.id, options);
        res.json(transactions);
    } catch (error) {
        console.error('API wallet transactions error:', error);
        res.status(500).json({ error: 'Unable to load transaction history' });
    }
});

router.post('/api/wallet/deposit', async (req, res) => {
    try {
        const result = await WalletService.depositCash(req.session.user.id, req.body.amount, req.body.description);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('API wallet deposit error:', error);
        const status = error.message.includes('Invalid') ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

router.post('/api/wallet/withdraw', async (req, res) => {
    try {
        const result = await WalletService.withdrawCash(req.session.user.id, req.body.amount, req.body.description);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('API wallet withdrawal error:', error);
        const status = error.message.includes('Insufficient') || error.message.includes('Invalid') ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

router.get('/api/wallet/roi-history', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const roiHistory = await WalletService.getROIHistory(req.session.user.id, days);
        res.json(roiHistory);
    } catch (error) {
        console.error('API wallet ROI history error:', error);
        res.status(500).json({ error: 'Unable to load ROI history' });
    }
});

router.get('/api/wallet/summary', async (req, res) => {
    try {
        const summary = await WalletService.getWalletSummary(req.session.user.id);
        res.json(summary);
    } catch (error) {
        console.error('API wallet summary error:', error);
        res.status(500).json({ error: 'Unable to load wallet summary' });
    }
});

// ===== INVESTMENT API ENDPOINTS =====

router.post('/api/invest-fund', async (req, res) => {
    try {
        const result = await InvestmentService.investInFund(
            req.session.user.id,
            req.body.fundSymbol,
            req.body.amount,
            req.body.navPrice
        );
        res.json(result);
    } catch (error) {
        console.error('Fund investment error:', error);
        const status = error.message.includes('Insufficient') || error.message.includes('Invalid') ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

router.post('/api/sell-fund', async (req, res) => {
    try {
        const result = await InvestmentService.sellFundUnits(
            req.session.user.id,
            req.body.fundSymbol,
            req.body.units
        );
        res.json(result);
    } catch (error) {
        console.error('Fund sale error:', error);
        const status = error.message.includes('Insufficient') || error.message.includes('Invalid') ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

router.get('/api/user-holdings', async (req, res) => {
    try {
        const holdings = await InvestmentService.getUserHoldings(req.session.user.id);
        res.json(holdings);
    } catch (error) {
        console.error('Get holdings error:', error);
        res.status(500).json({ error: 'Unable to load holdings data' });
    }
});

// ===== SUBSCRIPTION API ENDPOINTS =====

router.get('/api/user-subscription', async (req, res) => {
    try {
        const subscription = await SubscriptionService.getUserSubscription(req.session.user.id);
        res.json(subscription);
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Unable to load subscription data' });
    }
});

router.post('/api/purchase-premium', async (req, res) => {
    try {
        const result = await SubscriptionService.purchasePremium(
            req.session.user.id, 
            req.body.planType, 
            req.body.amount
        );
        res.json(result);
    } catch (error) {
        console.error('Purchase premium error:', error);
        const status = error.message.includes('Insufficient') || error.message.includes('already have') ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

module.exports = router;