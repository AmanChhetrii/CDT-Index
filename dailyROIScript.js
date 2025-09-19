// dailyROIScript.js - Save today's ROI data for all users (CORRECTED)
const mongoose = require('mongoose');
const User = require('./models/User');
const ROI = require('./models/ROI');
const NAV = require('./models/NAV');
require('dotenv').config();

async function saveTodaysROIForAllUsers() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');
        
        // Get current date and time
        const today = new Date();
        
        console.log(`Saving ROI data for ${today.toString()}`);
        
        // Find all users with portfolio data or holdings
        const users = await User.find({
            $or: [
                { 'portfolio.totalInvestmentValue': { $gt: 0 } },
                { 'portfolio.cashBalance': { $gt: 0 } },
                { 'holdings.0': { $exists: true } }
            ]
        }).select('_id firstName lastName portfolio holdings');

        console.log(`Found ${users.length} users with portfolio data`);

        let saved = 0;
        let skipped = 0;
        let errors = 0;

        for (const user of users) {
            try {
                const userId = new mongoose.Types.ObjectId(user._id);
                
                // Calculate current market value of fund holdings
                let currentFundValue = 0;
                
                if (user.holdings && user.holdings.length > 0) {
                    console.log(`Calculating fund values for ${user.firstName} ${user.lastName} (${user.holdings.length} funds)`);
                    
                    for (const holding of user.holdings) {
                        try {
                            // Get current NAV for this fund
                            const currentNAV = await NAV.findOne({
                                fundSymbol: holding.fundSymbol,
                                granularity: 'daily'
                            }).sort({ date: -1 }).lean();
                            
                            if (currentNAV && currentNAV.nav > 0) {
                                const fundValue = holding.units * currentNAV.nav;
                                currentFundValue += fundValue;
                                console.log(`  ${holding.fundSymbol}: ${holding.units} units × $${currentNAV.nav} = $${fundValue.toFixed(2)}`);
                            } else {
                                console.log(`  ${holding.fundSymbol}: No current NAV found`);
                            }
                        } catch (navError) {
                            console.error(`  Error getting NAV for ${holding.fundSymbol}:`, navError.message);
                        }
                    }
                } else {
                    console.log(`${user.firstName} ${user.lastName} has no fund holdings`);
                }
                
                // Portfolio Value = ONLY current fund market value (no cash)
                const portfolio = user.portfolio || {};
                const cashBalance = portfolio.cashBalance || 0;
                const totalValue = currentFundValue;
                
                console.log(`${user.firstName} ${user.lastName}: Cash ${cashBalance} (excluded) + Funds ${currentFundValue.toFixed(2)} = Portfolio ${totalValue.toFixed(2)}`);
                
                // Only save if total value is greater than 0
                if (totalValue > 0) {
                    // Save ROI record with current timestamp
                    await ROI.create({
                        userId: userId,
                        date: today,
                        totalPortfolioValue: totalValue
                    });
                    
                    console.log(`✓ Saved ROI for ${user.firstName} ${user.lastName}: $${totalValue.toFixed(2)}`);
                    saved++;
                } else {
                    console.log(`⚠ Skipped ${user.firstName} ${user.lastName}: Zero portfolio value`);
                    skipped++;
                }
                
            } catch (userError) {
                console.error(`Error processing ${user.firstName} ${user.lastName}:`, userError.message);
                errors++;
            }
        }
        
        console.log('\n=== Summary ===');
        console.log(`Saved: ${saved}`);
        console.log(`Skipped: ${skipped}`);
        console.log(`Errors: ${errors}`);
        
        if (saved > 0) {
            console.log('ROI data saved successfully!');
        }
        
    } catch (error) {
        console.error('Script error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the script
saveTodaysROIForAllUsers();