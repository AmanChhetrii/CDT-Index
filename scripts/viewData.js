// View daily data for BTC
// node scripts/viewData.js daily BTC

// View weekly data for ETH
// node scripts/viewData.js weekly ETH

// View monthly data for SOL
// node scripts/viewData.js monthly SOL

// View help
// node scripts/viewData.js

// scripts/viewData.js - Display historical data in chronological order
require('dotenv').config();
const mongoose = require('mongoose');
const CryptoAsset = require('../models/CryptoAsset');
const CryptoPrice = require('../models/CryptoPrice');

async function viewHistoricalData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');
        
        // Get command line arguments
        const args = process.argv.slice(2);
        const granularity = args[0] || 'daily'; // default to daily
        const symbol = args[1] || 'BTC'; // default to BTC
        
        // Validate granularity
        if (!['daily', 'weekly', 'monthly'].includes(granularity)) {
            console.log('Usage: node scripts/viewData.js <granularity> [symbol]');
            console.log('Granularity options: daily, weekly, monthly');
            console.log('Symbol options: BTC, ETH, SOL, AVAX, DOGE, LINK, MANA');
            return;
        }
        
        console.log(`Displaying ${granularity.toUpperCase()} data for ${symbol} in chronological order\n`);
        
        // Fetch data in chronological order (oldest first)
        const priceData = await CryptoPrice.find({
            symbol: symbol.toUpperCase(),
            granularity: granularity
        }).sort({ date: 1 }).select('date price volume source');
        
        if (priceData.length === 0) {
            console.log(`No ${granularity} data found for ${symbol}`);
            return;
        }
        
        // Display table header
        console.log('┌──────┬─────────────┬──────────────┬─────────────┬──────────────┐');
        console.log('│ #    │ Date        │ Price (USD)  │ Volume      │ Source       │');
        console.log('├──────┼─────────────┼──────────────┼─────────────┼──────────────┤');
        
        // Display data rows
        priceData.forEach((record, index) => {
            const dateStr = record.date.toISOString().split('T')[0]; // YYYY-MM-DD
            const price = `$${record.price.toFixed(2)}`;
            const volume = record.volume.toLocaleString();
            const source = record.source || 'unknown';
            
            console.log(`│ ${(index + 1).toString().padEnd(4)} │ ${dateStr} │ ${price.padEnd(12)} │ ${volume.padEnd(11)} │ ${source.padEnd(12)} │`);
        });
        
        console.log('└──────┴─────────────┴──────────────┴─────────────┴──────────────┘');
        
        // Display summary
        const firstDate = priceData[0].date.toISOString().split('T')[0];
        const lastDate = priceData[priceData.length - 1].date.toISOString().split('T')[0];
        const firstPrice = priceData[0].price;
        const lastPrice = priceData[priceData.length - 1].price;
        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
        
        console.log(`\nSummary:`);
        console.log(`Total Records: ${priceData.length}`);
        console.log(`Date Range: ${firstDate} to ${lastDate}`);
        console.log(`Price Range: $${firstPrice.toFixed(2)} to $${lastPrice.toFixed(2)} (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%)`);
        
        // Show available granularities for this crypto
        const availableGranularities = await CryptoPrice.distinct('granularity', { symbol: symbol.toUpperCase() });
        console.log(`Available granularities for ${symbol}: ${availableGranularities.join(', ')}`);
        
    } catch (error) {
        console.error('Error viewing data:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Usage instructions
if (process.argv.length < 3) {
    console.log('\nUsage: node scripts/viewData.js <granularity> [symbol]');
    console.log('\nExamples:');
    console.log('  node scripts/viewData.js daily BTC');
    console.log('  node scripts/viewData.js weekly ETH');
    console.log('  node scripts/viewData.js monthly SOL');
    console.log('\nGranularity options: daily, weekly, monthly');
    console.log('Symbol options: BTC, ETH, SOL, AVAX, DOGE, LINK, MANA\n');
}

if (require.main === module) {
    viewHistoricalData();
}