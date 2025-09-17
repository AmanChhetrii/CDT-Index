// dailyROIScript.js - Save today's ROI data for all users
const mongoose = require('mongoose');
const User = require('./models/User');
const ROI = require('./models/ROI');
require('dotenv').config();

async function saveTodaysROIForAllUsers() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');
        
        // Get current date and time
        const today = new Date();
        
        console.log(`Saving ROI data for ${today.toString()}`);
        
        // Find all users with portfolio data
        const users = await User.find({
            $or: [
                { 'portfolio.totalInvestmentValue': { $gt: 0 } },
                { 'portfolio.cashBalance': { $gt: 0 } }
            ]
        }).select('_id firstName lastName portfolio');

        console.log(`Found ${users.length} users with portfolio data`);

        let saved = 0;
        let skipped = 0;
        let errors = 0;

        for (const user of users) {
            try {
                const userId = new mongoose.Types.ObjectId(user._id);
                
                // Calculate total portfolio value
                const portfolio = user.portfolio || {};
                const totalValue = (portfolio.cashBalance || 0) + (portfolio.totalInvestmentValue || 0);
                
                // Save ROI record with current timestamp
                await ROI.create({
                    userId: userId,
                    date: today,
                    totalPortfolioValue: totalValue
                });
                
                console.log(`Saved ROI for ${user.firstName} ${user.lastName}: ${totalValue.toFixed(2)}`);
                saved++;
                
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