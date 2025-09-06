// checkMATICData.js
require('dotenv').config();
const mongoose = require('mongoose');
const PriceHistory = require('../models/PriceHistory');

async function checkMATICData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex');
        
        // Check MATIC price history
        const maticData = await PriceHistory.find({ symbol: 'MATIC' }).sort({ date: 1 });
        
        console.log('MATIC Historical Data Status:');
        console.log('============================');
        console.log('Total MATIC records:', maticData.length);
        
        if (maticData.length > 0) {
            console.log('First record:', maticData[0].date);
            console.log('Last record:', maticData[maticData.length - 1].date);
            console.log('Price range: $' + Math.min(...maticData.map(d => d.price)).toFixed(6) + 
                       ' - $' + Math.max(...maticData.map(d => d.price)).toFixed(6));
        } else {
            console.log('No MATIC historical data found');
        }
        
        // Check all cryptos data status
        console.log('\nAll Cryptos Data Summary:');
        console.log('=========================');
        const allCryptos = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'BNB', 'ADA', 'DOT', 'LINK', 'APT', 'ARB', 'SUI', 'MANA', 'XRP', 'DOGE'];
        
        for (const symbol of allCryptos) {
            const count = await PriceHistory.countDocuments({ symbol });
            console.log(symbol + ': ' + count + ' records');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkMATICData();