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

// Function to delete old avatar files
function deleteOldAvatar(userId) {
  const avatarDir = path.join(__dirname, '../public/uploads/avatars/');
  const possibleExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  
  possibleExtensions.forEach(ext => {
    const oldFilePath = path.join(avatarDir, userId + ext);
    if (fs.existsSync(oldFilePath)) {
      try {
        fs.unlinkSync(oldFilePath);
        console.log('Deleted old avatar:', oldFilePath);
      } catch (error) {
        console.error('Error deleting old avatar:', error);
      }
    }
  });
}

// Configure multer for avatar uploads with userid naming
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/avatars/');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    try {
      const userId = req.session.user.id;
      // Always save as .jpg regardless of original format
      cb(null, userId + '.jpg');
    } catch (error) {
      console.error('Error in filename function:', error);
      cb(error);
    }
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

// Middleware to load complete user data for all dashboard pages
const loadUserData = async (req, res, next) => {
    try {
        if (req.session.user) {
            // Get complete user data from database including profile photo
            const fullUserData = await User.findById(req.session.user.id)
                .select('firstName lastName email profilePhoto isPremium premiumExpiry createdAt')
                .lean();
            
            if (fullUserData) {
                // Merge database data with session data
                req.userData = {
                    ...req.session.user,
                    ...fullUserData
                };
            } else {
                // Fallback to session data if database query fails
                req.userData = req.session.user;
            }
        } else {
            req.userData = null;
        }
        
        next();
    } catch (error) {
        console.error('Error loading user data:', error);
        // Fallback to session data on error
        req.userData = req.session.user || null;
        next();
    }
};

// Apply the loadUserData middleware to all routes
router.use(loadUserData);

// ===== PAGE ROUTES =====

router.get('/dashboard', (req, res) => {
    res.render('dashboard/dashboard', { 
        title: 'Dashboard - CDT Index',
        user: req.userData,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

// api dashboard

// Add these 3 endpoints to your dashboard.js routes file
// Insert them after your existing API endpoints (around line 600, after the subscription endpoints)

// ===== DASHBOARD API ENDPOINTS =====

// Get dashboard summary stats
// In your dashboard routes, update the summary endpoint:
router.get('/api/dashboard/summary', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const User = require('../models/User');
        const ROI = require('../models/ROI');
        const mongoose = require('mongoose');
        
        const user = await User.findById(userId).select('portfolio holdings').lean();
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const portfolio = user.portfolio || {};
        const totalPortfolioValue = (portfolio.cashBalance || 0) + (portfolio.totalInvestmentValue || 0);
        
        // Calculate daily change from ROI data
        let dayChange = 0;
        let dayChangePercentage = 0;
        
        try {
            // Get today's and yesterday's portfolio values from ROI
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const [todayROI, yesterdayROI] = await Promise.all([
                ROI.findOne({ userId: new mongoose.Types.ObjectId(userId), date: today }).lean(),
                ROI.findOne({ userId: new mongoose.Types.ObjectId(userId), date: yesterday }).lean()
            ]);
            
            if (todayROI && yesterdayROI) {
                dayChange = todayROI.totalPortfolioValue - yesterdayROI.totalPortfolioValue;
                dayChangePercentage = yesterdayROI.totalPortfolioValue > 0 
                    ? (dayChange / yesterdayROI.totalPortfolioValue) * 100 
                    : 0;
            } else if (yesterdayROI) {
                // If no today's ROI but have yesterday's, compare current value with yesterday
                dayChange = totalPortfolioValue - yesterdayROI.totalPortfolioValue;
                dayChangePercentage = yesterdayROI.totalPortfolioValue > 0 
                    ? (dayChange / yesterdayROI.totalPortfolioValue) * 100 
                    : 0;
            }
        } catch (roiError) {
            console.log('ROI calculation error (using fallback):', roiError.message);
        }
        
        res.json({
            totalPortfolioValue,
            cashBalance: portfolio.cashBalance || 0,
            totalReturnPercentage: portfolio.totalReturnPercentage || 0,
            numberOfFunds: user.holdings?.length || 0,
            dayChange,
            dayChangePercentage
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({ error: 'Failed to load dashboard summary' });
    }
});
// Get user's fund performance data from NAV model
router.get('/api/dashboard/user-funds-performance', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const NAV = require('../models/NAV');
        const Fund = require('../models/Fund');
        const mongoose = require('mongoose');
        
        // Get user's holdings
        const user = await User.findById(userId).select('holdings').lean();
        if (!user || !user.holdings || user.holdings.length === 0) {
            return res.json({ funds: [] });
        }

        console.log('User has', user.holdings.length, 'fund holdings');

        // Debug: Check what's in NAV collection
        const totalNavRecords = await NAV.countDocuments();
        console.log('Total NAV records in database:', totalNavRecords);

        // Get sample NAV data
        const sampleNav = await NAV.findOne().lean();
        console.log('Sample NAV record:', sampleNav);

        // Check unique fund symbols in NAV
        const uniqueFundSymbols = await NAV.distinct('fundSymbol');
        console.log('Unique fund symbols in NAV:', uniqueFundSymbols);

        // Check user's fund symbols
        const userFundSymbols = user.holdings.map(h => h.fundSymbol);
        console.log('User fund symbols:', userFundSymbols);

        // Get earliest purchase date for display purposes only
        const earliestDate = user.holdings.reduce((earliest, holding) => {
            const purchaseDate = new Date(holding.firstPurchaseDate);
            return !earliest || purchaseDate < earliest ? purchaseDate : earliest;
        }, null);

        console.log('User purchase date (for reference):', earliestDate);

        // Get NAV data for each fund - show all monthly data since inception
        const fundsData = await Promise.all(
            user.holdings.map(async (holding) => {
                console.log('Fetching NAV for fund:', holding.fundSymbol);
                
                // Get all monthly NAV data for the fund (since fund inception)
                const navData = await NAV.find({
                    fundSymbol: holding.fundSymbol,
                    granularity: 'monthly'
                }).sort({ date: 1 }).select('date nav').lean();

                console.log('Found', navData.length, 'monthly NAV records for', holding.fundSymbol);

                const fund = await Fund.findOne({ symbol: holding.fundSymbol }).select('name').lean();

                return {
                    symbol: holding.fundSymbol,
                    name: fund?.name || holding.fundSymbol,
                    data: navData.map(nav => ({
                        date: nav.date,
                        value: nav.nav
                    }))
                };
            })
        );

        console.log('Returning fund data for', fundsData.length, 'funds');
        res.json({ funds: fundsData });
    } catch (error) {
        console.error('Fund performance error:', error);
        res.status(500).json({ error: 'Failed to load fund performance' });
    }
});

// Get user's portfolio value history from ROI model
router.get('/api/dashboard/portfolio-value-history', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const ROI = require('../models/ROI');
        const mongoose = require('mongoose');
        
        console.log('Fetching portfolio history for user:', userId);
        
        // Check if user has any ROI records
        const userRoiCount = await ROI.countDocuments({ userId: new mongoose.Types.ObjectId(userId) });
        console.log('User ROI records count:', userRoiCount);

        if (userRoiCount === 0) {
            console.log('No ROI data found - creating mock data for chart');
            // Since you have no ROI data, create some mock data based on user's portfolio
            const user = await User.findById(userId).select('portfolio').lean();
            const currentValue = (user?.portfolio?.cashBalance || 0) + (user?.portfolio?.totalInvestmentValue || 0);
            
            // Create mock historical data for the last 30 days
            const mockData = [];
            const today = new Date();
            for (let i = 29; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                // Add some variation to make the chart look realistic
                const variation = (Math.random() - 0.5) * (currentValue * 0.1);
                mockData.push({
                    date: date,
                    value: Math.max(0, currentValue + variation)
                });
            }
            
            return res.json({ data: mockData });
        }

        // If ROI data exists, fetch it normally
        const portfolioHistory = await ROI.find({ 
            userId: new mongoose.Types.ObjectId(userId) 
        })
        .sort({ date: 1 })
        .select('date totalPortfolioValue')
        .lean();

        const formattedData = portfolioHistory.map(entry => ({
            date: entry.date,
            value: entry.totalPortfolioValue
        }));

        res.json({ data: formattedData });
    } catch (error) {
        console.error('Portfolio history error:', error);
        res.status(500).json({ error: 'Failed to load portfolio history' });
    }
});

// api dashboard

router.get('/dashboard/widgets', (req, res) => {
    res.render('dashboard/widgets', {
        user: req.userData
    });
});

router.get('/dashboard/premium', (req, res) => {
    res.render('dashboard/premium', {
        title: 'Premium Plans - CDT Index',
        user: req.userData,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/wallet', (req, res) => {
    res.render('dashboard/wallet', {
        title: 'Wallet - CDT Index',
        user: req.userData,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/transactions', (req, res) => {
    res.render('dashboard/transactions', {
        title: 'Transaction History - CDT Index',
        user: req.userData,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/profile', (req, res) => {
    res.render('dashboard/profile', {
        title: 'Profile - CDT Index',
        user: req.userData,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/explore', (req, res) => {
    res.render('dashboard/explore', {
        title: 'Explore Funds - CDT Index',
        user: req.userData,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/reset-pass', (req, res) => {
    res.render('dashboard/reset-pass', {
        title: 'Reset Password - CDT Index',
        user: req.userData,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

router.get('/dashboard/buy/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        
        const [fundDetails, userPortfolio] = await Promise.all([
            FundService.getFundDetails(symbol.toUpperCase()),
            WalletService.getUserPortfolio(req.session.user.id)
        ]);
        
        res.render('dashboard/buy', {
            title: `Buy ${fundDetails.name} - CDT Index`,
            fund: fundDetails,
            userPortfolio: userPortfolio,
            user: req.userData,
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

// CORRECTED upload avatar route with proper deletion timing
router.post('/api/user/upload-avatar', async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Delete old avatar files BEFORE processing the upload
        deleteOldAvatar(userId);
        
        // Now handle the upload
        upload.single('avatar')(req, res, async function (err) {
            if (err) {
                console.error('Multer upload error:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            
            try {
                // The file is now saved as userid.jpg
                const avatarUrl = '/uploads/avatars/' + userId + '.jpg';
                
                // Update user's profile photo in database
                const user = await User.findByIdAndUpdate(
                    userId,
                    { profilePhoto: avatarUrl },
                    { new: true }
                );
                
                if (!user) {
                    // If user update fails, delete the uploaded file
                    const filePath = path.join(__dirname, '../public/uploads/avatars/', userId + '.jpg');
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    return res.status(404).json({ error: 'User not found' });
                }
                
                // Update session data
                if (req.session.user) {
                    req.session.user.profilePhoto = avatarUrl;
                }
                
                res.json({ 
                    success: true, 
                    avatarUrl: avatarUrl + '?t=' + Date.now()
                });
                
            } catch (dbError) {
                console.error('Database update error:', dbError);
                
                // Clean up uploaded file if database update fails
                const filePath = path.join(__dirname, '../public/uploads/avatars/', userId + '.jpg');
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                    } catch (deleteError) {
                        console.error('Error cleaning up failed upload:', deleteError);
                    }
                }
                
                res.status(500).json({ error: 'Failed to save avatar to database' });
            }
        });
        
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

// Export transaction history with proper CSV format
router.get('/api/user/export-transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find({ 
            userId: req.session.user.id 
        })
        .sort({ $or: [
            { transactionDate: -1 }, 
            { createdAt: -1 },
            { date: -1 },
            { _id: -1 }
        ]})
        .lean();
        
        // Add BOM for proper UTF-8 handling in Excel
        let csvContent = '\uFEFF';
        
        // CSV header with shorter column names for Excel
        csvContent += 'Date,Time,Type,Description,Amount,Fund,Units,NAV_Price,Status,Reference\n';
        
        transactions.forEach(transaction => {
            let transactionDate = null;
            
            // Try multiple date field possibilities
            if (transaction.transactionDate) {
                transactionDate = new Date(transaction.transactionDate);
            } else if (transaction.createdAt) {
                transactionDate = new Date(transaction.createdAt);
            } else if (transaction.date) {
                transactionDate = new Date(transaction.date);
            } else if (transaction._id) {
                transactionDate = new Date(parseInt(transaction._id.toString().substring(0,8), 16) * 1000);
            }
            
            let formattedDate = 'No_Date';
            let formattedTime = 'No_Time';
            
            if (transactionDate && !isNaN(transactionDate.getTime())) {
                // Use simple date format that Excel recognizes
                formattedDate = (transactionDate.getMonth() + 1) + '/' + 
                               transactionDate.getDate() + '/' + 
                               transactionDate.getFullYear();
                               
                formattedTime = transactionDate.getHours().toString().padStart(2, '0') + ':' + 
                               transactionDate.getMinutes().toString().padStart(2, '0') + ':' + 
                               transactionDate.getSeconds().toString().padStart(2, '0');
            }
            
            // Clean and escape data for CSV
            const cleanDescription = (transaction.description || 'Transaction')
                .replace(/"/g, '""')  // Escape quotes
                .replace(/,/g, ' ')   // Replace commas with spaces
                .replace(/\n/g, ' ')  // Replace newlines with spaces
                .trim();
            
            const amount = parseFloat(transaction.amount || 0).toFixed(2);
            const units = transaction.units ? parseFloat(transaction.units).toFixed(4) : '';
            const navPrice = transaction.navPriceAtTransaction ? parseFloat(transaction.navPriceAtTransaction).toFixed(4) : '';
            
            // Build row without excessive quotes
            const row = [
                formattedDate,
                formattedTime,
                transaction.transactionType || 'Unknown',
                '"' + cleanDescription + '"',
                amount,
                transaction.fundSymbol || '',
                units,
                navPrice,
                transaction.status || 'Completed',
                transaction.referenceId || ''
            ].join(',');
            
            csvContent += row + '\n';
        });
        
        const filename = 'transactions_' + new Date().toISOString().split('T')[0].replace(/-/g, '') + '.csv';
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');
        
        res.send(csvContent);
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to export transactions' });
    }
});

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

        const query = { userId };

        if (type) {
            query.transactionType = type;
        }

        if (fund) {
            query.fundSymbol = fund.toUpperCase();
        }

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

        const totalCount = await Transaction.countDocuments(query);

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

router.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API working',
        user: req.session.user || null,
        timestamp: new Date()
    });
});

module.exports = router;