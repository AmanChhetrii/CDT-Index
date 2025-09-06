require('dotenv').config();
const mongoose = require('mongoose');
const CryptoAsset = require('../models/CryptoAsset');
const CryptoPrice = require('../models/CryptoPrice');

if (!global.fetch) {
    global.fetch = require('node-fetch');
}

async function fetchDailyData() {
    try {
        console.log('=== Fetching Daily Data (90 days) ===\n');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');
        
        const cryptos = await CryptoAsset.getActiveCryptos();
        let totalRecords = 0;
        
        for (const crypto of cryptos) {
            console.log(`Fetching daily data for ${crypto.symbol}...`);
            
            try {
                // Use CryptoCompare for proper daily data (90 records exactly)
                const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${crypto.symbol}&tsym=USD&limit=90`;
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`CryptoCompare API failed: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (!data.Data || !data.Data.Data) {
                    throw new Error('Invalid CryptoCompare response structure');
                }
                
                // Convert CryptoCompare data to our format
                const dailyRecords = [];
                for (const dayData of data.Data.Data) {
                    dailyRecords.push({
                        symbol: crypto.symbol,
                        date: new Date(dayData.time * 1000),
                        price: dayData.close,
                        volume: dayData.volumeto || 0,
                        marketCap: 0,
                        granularity: 'daily',
                        source: 'cryptocompare'
                    });
                }
                
                let savedCount = 0;
                for (const record of dailyRecords) {
                    try {
                        await CryptoPrice.create(record);
                        savedCount++;
                    } catch (error) {
                        // Skip duplicates silently
                        if (!error.message.includes('duplicate')) {
                            console.log(`Warning: Failed to save record for ${record.date}: ${error.message}`);
                        }
                    }
                }
                
                console.log(`${crypto.symbol}: ${savedCount} daily records saved`);
                totalRecords += savedCount;
                
                // 8 second delay between cryptocurrencies to respect API limits
                await new Promise(resolve => setTimeout(resolve, 8000));
                
            } catch (error) {
                console.error(`Failed ${crypto.symbol}: ${error.message}`);
            }
        }
        
        console.log(`\nDaily data fetch completed: ${totalRecords} total records`);
        
        // Show final summary
        console.log('\n=== Daily Data Summary ===');
        for (const crypto of await CryptoAsset.getActiveCryptos()) {
            const count = await CryptoPrice.countDocuments({
                symbol: crypto.symbol,
                granularity: 'daily'
            });
            console.log(`${crypto.symbol}: ${count} daily records`);
        }
        
    } catch (error) {
        console.error('Daily fetch failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    fetchDailyData();
}

module.exports = { fetchDailyData };