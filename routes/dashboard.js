// routes/dashboard.js - Clean routes with service separation
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Import services
const User = require('../models/User');
const FundService = require('../services/fundService');
const ChartService = require('../services/chartService');
const WalletService = require('../services/walletService');
const SubscriptionService = require('../services/subscriptionService');
const InvestmentService = require('../services/investmentService');
const Transaction = require('../models/Transaction');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads/avatars/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + req.session.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

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

router.get('/dashboard/wallet', (req, res) => {
    res.render('dashboard/wallet', {
        title: 'Wallet - CDT Index',
        user: req.session.user,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/transactions', (req, res) => {
    res.render('dashboard/transactions', {
        title: 'Transaction History - CDT Index',
        user: req.session.user,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

// Profile page route
router.get('/dashboard/profile', (req, res) => {
    res.render('dashboard/profile', {
        title: 'Profile - CDT Index',
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

// Change password page route
router.get('/dashboard/reset-pass', (req, res) => {
    res.render('dashboard/reset-pass', {
        title: 'Reset Password - CDT Index',
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

// ===== PROFILE API ENDPOINTS =====

// Get user profile
router.get('/api/user/profile', async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
            .select('-password')
            .lean();
            
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

// Update user profile
router.put('/api/user/update-profile', async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        
        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }
        
        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            { 
                firstName: firstName.trim(),
                lastName: lastName.trim()
            },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update session data
        req.session.user.firstName = user.firstName;
        req.session.user.lastName = user.lastName;
        
        res.json({ 
            success: true, 
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            }
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Upload avatar
router.post('/api/user/upload-avatar', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const avatarUrl = '/uploads/avatars/' + req.file.filename;
        
        // Update user's profile photo in database
        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            { profilePhoto: avatarUrl },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ 
            success: true, 
            avatarUrl: avatarUrl 
        });
        
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

// Export transaction history
router.get('/api/user/export-transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find({ 
            userId: req.session.user.id 
        })
        .sort({ transactionDate: -1 })
        .lean();
        
        // Create CSV content
        let csvContent = 'Date,Type,Description,Amount,Fund,Units,NAV Price,Status\n';
        
        transactions.forEach(transaction => {
            const row = [
                new Date(transaction.transactionDate).toLocaleDateString(),
                transaction.transactionType,
                `"${transaction.description}"`,
                transaction.amount,
                transaction.fundSymbol || '',
                transaction.units || '',
                transaction.navPriceAtTransaction || '',
                transaction.status
            ].join(',');
            csvContent += row + '\n';
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=transaction-history.csv');
        res.send(csvContent);
        
    } catch (error) {
        console.error('Export transactions error:', error);
        res.status(500).json({ error: 'Failed to export transactions' });
    }
});

// Change password API
router.post('/api/user/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'New passwords do not match' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        
        user.password = newPassword;
        await user.save();
        
        res.json({ success: true, message: 'Password changed successfully' });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ===== TRANSACTION API ENDPOINTS =====

router.get('/api/transactions', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.session.user.id;
        const {
            type = '',
            fund = '',
            period = '1Y',
            page = 1,
            limit = 20
        } = req.query;

        // Build query
        const query = { userId };

        // Add type filter
        if (type) {
            query.transactionType = type;
        }

        // Add fund filter
        if (fund) {
            query.fundSymbol = fund.toUpperCase();
        }

        // Add period filter
        const now = new Date();
        let startDate;
        
        switch (period.toUpperCase()) {
            case '1M':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '3M':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '6M':
                startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
                break;
            case '1Y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            case 'ALL':
                startDate = new Date('2020-01-01');
                break;
            default:
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        }

        if (startDate) {
            query.transactionDate = { $gte: startDate };
        }

        // Get total count
        const totalCount = await Transaction.countDocuments(query);

        // Get paginated transactions
        const transactions = await Transaction.find(query)
            .sort({ transactionDate: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .lean();

        res.json({
            transactions,
            totalCount,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit))
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to load transactions' });
    }
});

// Get specific transaction details
router.get('/api/transactions/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        const userId = req.session.user.id;
        
        const transaction = await Transaction.findOne({ 
            _id: transactionId, 
            userId 
        }).lean();
        
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        res.json(transaction);
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({ error: 'Failed to load transaction details' });
    }
});

// Get transaction summary for user
router.get('/api/transactions/summary', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const timeframe = req.query.timeframe || '1Y';
        
        const summary = await Transaction.getTransactionSummary(userId, timeframe);
        res.json(summary);
    } catch (error) {
        console.error('Error fetching transaction summary:', error);
        res.status(500).json({ error: 'Failed to load transaction summary' });
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

// Add this debugging to your routes/dashboard.js

// Debug middleware - add this right after requireAuth middleware
router.use((req, res, next) => {
    console.log('=== DEBUG INFO ===');
    console.log('Request URL:', req.url);
    console.log('Session user:', req.session.user);
    console.log('User ID type:', typeof req.session.user?.id);
    console.log('User ID value:', req.session.user?.id);
    console.log('==================');
    next();
});

// Enhanced profile endpoint with debugging
router.get('/api/user/profile', async (req, res) => {
    try {
        console.log('Profile API called');
        console.log('Session user:', req.session.user);
        console.log('Looking for user ID:', req.session.user.id);
        
        const user = await User.findById(req.session.user.id)
            .select('-password')
            .lean();
        
        console.log('User found in DB:', user ? 'YES' : 'NO');
        console.log('User data:', user);
        
        if (!user) {
            console.log('User not found in database');
            return res.status(404).json({ error: 'User not found' });
        }
        
        const responseData = { user };
        console.log('Sending response:', responseData);
        
        res.json(responseData);
    } catch (error) {
        console.error('Get profile error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to load profile: ' + error.message });
    }
});

// Enhanced wallet portfolio endpoint
router.get('/api/wallet/portfolio', async (req, res) => {
    try {
        console.log('Wallet portfolio API called');
        console.log('User ID:', req.session.user.id);
        
        const portfolio = await WalletService.getUserPortfolio(req.session.user.id);
        console.log('Portfolio from service:', portfolio);
        
        // Ensure consistent response format
        const response = {
            portfolio: {
                cashBalance: portfolio?.cashBalance || 0,
                investmentValue: portfolio?.totalInvestmentValue || 0,
                totalValue: portfolio?.totalPortfolioValue || 0
            }
        };
        
        console.log('Sending portfolio response:', response);
        res.json(response);
    } catch (error) {
        console.error('API wallet portfolio error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Unable to load portfolio data: ' + error.message });
    }
});

// Enhanced transactions endpoint
router.get('/api/wallet/transactions', async (req, res) => {
    try {
        console.log('Wallet transactions API called');
        console.log('User ID:', req.session.user.id);
        console.log('Query params:', req.query);
        
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            type: req.query.type
        };
        
        console.log('Transaction options:', options);
        
        const transactions = await WalletService.getUserTransactions(req.session.user.id, options);
        console.log('Transactions from service:', transactions);
        
        // Ensure consistent response format
        const response = {
            transactions: transactions?.transactions || [],
            totalCount: transactions?.totalCount || 0
        };
        
        console.log('Sending transactions response:', response);
        res.json(response);
    } catch (error) {
        console.error('API wallet transactions error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Unable to load transaction history: ' + error.message });
    }
});



module.exports = router;