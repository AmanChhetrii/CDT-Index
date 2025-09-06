require('dotenv').config();
const mongoose = require('mongoose');
const cryptoApi = require('../services/cryptoApi');

async function testApiService() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex');
        console.log('Connected to MongoDB for API test');
        
        console.log('\nTesting current price fetch...');
        await cryptoApi.fetchCurrentPrices();
        
        console.log('\nTesting fund NAV updates...');
        await cryptoApi.updateAllFundNAVs();
        
        console.log('\nAPI test completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('API test failed:', error);
        process.exit(1);
    }
}

testApiService();