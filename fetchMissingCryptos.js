// fetchMissingCryptos.js
require('dotenv').config();
const mongoose = require('mongoose');
const CryptoAsset = require('./models/CryptoAsset');
const historicalDataService = require('./services/historicalDataService');

async function fetchMissingCryptos() {
    try {
        console.log('Fetching missing cryptocurrency historical data...');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex');
        console.log('Connected to MongoDB');
        
        // List of cryptocurrencies that need historical data
        const missingSymbols = [
            'MATIC', 'BNB', 'ADA', 'DOT', 'LINK', 
            'APT', 'ARB', 'SUI', 'MANA', 'XRP', 'DOGE'
        ];
        
        console.log('Fetching data for ' + missingSymbols.length + ' cryptocurrencies...');
        
        for (let i = 0; i < missingSymbols.length; i++) {
            const symbol = missingSymbols[i];
            console.log('\n[' + (i + 1) + '/' + missingSymbols.length + '] Processing ' + symbol + '...');
            
            const crypto = await CryptoAsset.findOne({ symbol });
            
            if (crypto) {
                try {
                    await historicalDataService.importCryptoHistoricalData(crypto, 30, 'daily');
                    console.log('Successfully imported data for ' + symbol);
                } catch (error) {
                    console.error('Failed to import data for ' + symbol + ':', error.message);
                }
                
                // Rate limiting - 3 seconds between requests to avoid 429 errors
                if (i < missingSymbols.length - 1) {
                    console.log('Waiting 3 seconds to avoid rate limiting...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } else {
                console.error('Crypto asset not found for symbol: ' + symbol);
            }
        }
        
        console.log('\n=== Import Complete ===');
        console.log('Now calculating fund NAVs...');
        
        // After importing all missing data, recalculate fund NAVs
        await historicalDataService.calculateHistoricalFundNAVs();
        
        console.log('\n=== Final Status Check ===');
        
        // Check final data status
        const PriceHistory = require('./models/PriceHistory');
        for (const symbol of missingSymbols) {
            const count = await PriceHistory.countDocuments({ symbol });
            console.log(symbol + ': ' + count + ' records');
        }
        
        console.log('\nMissing crypto data import completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('Error fetching missing crypto data:', error);
        process.exit(1);
    }
}

fetchMissingCryptos();