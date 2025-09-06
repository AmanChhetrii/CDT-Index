// scripts/fetchMonthlyCryptoCompare.js
require('dotenv').config();
const mongoose = require('mongoose');
const CryptoAsset = require('../models/CryptoAsset');
const CryptoPrice = require('../models/CryptoPrice');

if (!global.fetch) {
    global.fetch = require('node-fetch');
}

async function fetchMonthlyDataCryptoCompare() {
    try {
        console.log('=== Fetching Monthly Data from CryptoCompare ===\n');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');
        
        const cryptos = await CryptoAsset.getActiveCryptos();
        let totalRecords = 0;
        
        for (const crypto of cryptos) {
            console.log(`Fetching monthly data for ${crypto.symbol}...`);
            
            try {
                // Get maximum daily data available (2000 days limit)
                const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${crypto.symbol}&tsym=USD&limit=2000`;
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`CryptoCompare API failed: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.Data || !data.Data.Data) {
                    throw new Error('Invalid CryptoCompare response');
                }
                
                // Sample every 30th day for monthly data
                const monthlyRecords = [];
                for (let i = 0; i < data.Data.Data.length; i += 30) {
                    const dayData = data.Data.Data[i];
                    monthlyRecords.push({
                        symbol: crypto.symbol,
                        date: new Date(dayData.time * 1000),
                        price: dayData.close,
                        volume: dayData.volumeto || 0,
                        marketCap: 0,
                        granularity: 'monthly',
                        source: 'cryptocompare'
                    });
                }
                
                let savedCount = 0;
                for (const record of monthlyRecords) {
                    try {
                        await CryptoPrice.create(record);
                        savedCount++;
                    } catch (error) {
                        if (!error.message.includes('duplicate')) {
                            console.log(`Warning: ${error.message}`);
                        }
                    }
                }
                
                console.log(`${crypto.symbol}: ${savedCount} monthly records saved`);
                totalRecords += savedCount;
                
                // 5 second delay
                await new Promise(resolve => setTimeout(resolve, 5000));
                
            } catch (error) {
                console.error(`Failed ${crypto.symbol}: ${error.message}`);
            }
        }
        
        console.log(`\nMonthly data fetch completed: ${totalRecords} total records`);
        
    } catch (error) {
        console.error('Monthly fetch failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    fetchMonthlyDataCryptoCompare();
}