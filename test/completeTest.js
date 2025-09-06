require('dotenv').config();
const mongoose = require('mongoose');
const cryptoApi = require('../services/cryptoApi');
const historicalDataService = require('../services/historicalDataService');
const { seedDatabase } = require('../seeds/fundData');

async function runCompleteBackendTest() {
    try {
        console.log('Starting complete backend test...');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex');
        console.log('Connected to MongoDB');
        
        // Step 1: Seed database with correct NAV values
        console.log('\n=== Step 1: Seeding Database ===');
        await seedDatabase();
        
        // Step 2: Fetch current crypto prices
        console.log('\n=== Step 2: Fetching Current Prices ===');
        await cryptoApi.fetchCurrentPrices();
        
        // Step 3: Import sample historical data (30 days for testing)
        console.log('\n=== Step 3: Importing Sample Historical Data ===');
        await historicalDataService.getQuickHistoricalSample();
        
        // Step 4: Update daily NAVs based on real prices
        console.log('\n=== Step 4: Updating Fund NAVs ===');
        await historicalDataService.updateDailyNAVs();
        
        // Step 5: Display final results
        console.log('\n=== Final Results ===');
        await displayFinalResults();
        
        console.log('\nComplete backend test finished successfully!');
        console.log('Your backend is ready for frontend development.');
        
        process.exit(0);
        
    } catch (error) {
        console.error('Backend test failed:', error);
        process.exit(1);
    }
}

async function displayFinalResults() {
    try {
        const Fund = require('../models/Fund');
        const NAVHistory = require('../models/NAVHistory');
        
        const funds = await Fund.find({ isActive: true }).sort({ displayOrder: 1 });
        
        console.log('Fund Performance Summary:');
        console.log('========================');
        
        for (const fund of funds) {
            const performance = await NAVHistory.getPerformanceSummary(fund._id);
            
            console.log('\n' + fund.name + ' (' + fund.symbol + '):');
            console.log('  Current NAV: $' + fund.currentNAV.toFixed(4));
            console.log('  Inception NAV: $' + fund.inceptionNAV.toFixed(2));
            console.log('  Total Return: ' + (fund.totalReturn > 0 ? '+' : '') + fund.totalReturn.toFixed(2) + '%');
            console.log('  Risk Level: ' + fund.riskLevel);
            console.log('  Featured: ' + (fund.featured ? 'Yes' : 'No'));
        }
        
        console.log('\nDatabase Collections:');
        console.log('====================');
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const collection of collections) {
            const count = await mongoose.connection.db.collection(collection.name).countDocuments();
            console.log('  ' + collection.name + ': ' + count + ' documents');
        }
        
    } catch (error) {
        console.error('Error displaying results:', error);
    }
}

// For individual testing - uncomment the function you want to test:

async function testHistoricalImport() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex');
    console.log('Testing historical data import...');
    await historicalDataService.importCompleteHistoricalData();
    process.exit(0);
}

async function testResetFunds() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex');
    console.log('Resetting funds to inception values...');
    await historicalDataService.resetFundsToInception();
    process.exit(0);
}

async function testSampleData() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex');
    console.log('Getting sample historical data...');
    await historicalDataService.getQuickHistoricalSample();
    process.exit(0);
}

// Run the complete test
runCompleteBackendTest();

// To run individual tests, comment out the line above and uncomment one of these:
// testHistoricalImport();
// testResetFunds();
// testSampleData();
