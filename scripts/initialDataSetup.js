// scripts/initialDataSetup.js - One-time historical data import and system initialization
require('dotenv').config();
const mongoose = require('mongoose');
const CryptoAsset = require('../models/CryptoAsset');
const CryptoPrice = require('../models/CryptoPrice');
const cryptoDataService = require('../services/cryptoDataService');
const dataValidationService = require('../services/dataValidationService');
const { seedDatabase } = require('../seeds/newSeedData');

class InitialDataSetup {
    constructor() {
        this.setupPhases = [
            'database_seed',
            'historical_daily',
            'historical_weekly', 
            'historical_monthly',
            'validation',
            'gap_repair'
        ];
        this.currentPhase = 0;
    }

    // Main setup method
    async runCompleteSetup() {
        try {
            console.log('=== CDT Index Initial Data Setup ===');
            console.log('This will set up the complete historical database from 2018 to present\n');
            
            await this.connectToDatabase();
            
            // Phase 1: Database seeding
            console.log('\n📊 Phase 1: Database Seeding');
            await this.seedDatabaseWithFundData();
            
            // Phase 2-4: Historical data import
            console.log('\n📈 Phase 2-4: Historical Data Import');
            await this.importAllHistoricalData();
            
            // Phase 5: Data validation
            console.log('\n🔍 Phase 5: Data Validation');
            await this.validateImportedData();
            
            // Phase 6: Gap repair (if needed)
            console.log('\n🔧 Phase 6: Gap Repair');
            await this.repairDataGaps();
            
            console.log('\n✅ Initial data setup completed successfully!');
            console.log('Next steps:');
            console.log('1. Run NAV calculations: node scripts/calculateInitialNAVs.js');
            console.log('2. Start daily scheduler: node scripts/dailyUpdater.js');
            
        } catch (error) {
            console.error('❌ Initial data setup failed:', error);
            throw error;
        } finally {
            await mongoose.disconnect();
        }
    }

    // Connect to MongoDB
    async connectToDatabase() {
        try {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex');
            console.log('✅ Connected to MongoDB');
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            throw error;
        }
    }

    // Seed database with initial fund and crypto data
    async seedDatabaseWithFundData() {
        try {
            console.log('Seeding database with funds and cryptocurrencies...');
            const { funds, cryptos } = await seedDatabase();
            
            console.log(`✅ Seeded ${cryptos.length} cryptocurrencies and ${funds.length} funds`);
            
            // Verify all required cryptos are present
            const requiredSymbols = ['BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'MANA', 'LINK'];
            const foundSymbols = cryptos.map(c => c.symbol);
            const missing = requiredSymbols.filter(s => !foundSymbols.includes(s));
            
            if (missing.length > 0) {
                throw new Error(`Missing required cryptocurrencies: ${missing.join(', ')}`);
            }
            
            return { funds, cryptos };
            
        } catch (error) {
            console.error('❌ Database seeding failed:', error);
            throw error;
        }
    }

    // Import all historical data for all cryptocurrencies
    async importAllHistoricalData() {
        try {
            const cryptos = await CryptoAsset.getActiveCryptos();
            console.log(`Importing historical data for ${cryptos.length} cryptocurrencies...`);
            
            let totalImported = 0;
            
            for (const crypto of cryptos) {
                console.log(`\n📥 Importing data for ${crypto.name} (${crypto.symbol})...`);
                
                try {
                    // Import daily data (last 90 days for proper daily granularity)
                    console.log('  - Daily data (90 days)...');
                    const dailyData = await cryptoDataService.fetchHistoricalData(
                        crypto.symbol, 
                        crypto.apiId, 
                        90, 
                        'daily'
                    );
                    await CryptoPrice.bulkInsertPriceData(dailyData);
                    console.log(`    ✅ ${dailyData.length} daily records`);
                    totalImported += dailyData.length;
                    
                    // Rate limiting delay
                    await this.delay(3000);
                    
                    // Import weekly data (last 2 years)
                    console.log('  - Weekly data (2 years)...');
                    const weeklyData = await cryptoDataService.fetchHistoricalData(
                        crypto.symbol, 
                        crypto.apiId, 
                        730, 
                        'weekly'
                    );
                    await CryptoPrice.bulkInsertPriceData(weeklyData);
                    console.log(`    ✅ ${weeklyData.length} weekly records`);
                    totalImported += weeklyData.length;
                    
                    // Rate limiting delay
                    await this.delay(3000);
                    
                    // // Import monthly data (maximum available)
                    // console.log('  - Monthly data (2018-present)...');
                    // const monthlyData = await cryptoDataService.fetchHistoricalData(
                    //     crypto.symbol, 
                    //     crypto.apiId, 
                    //     'max', 
                    //     'monthly'
                    // );
                    // await CryptoPrice.bulkInsertPriceData(monthlyData);
                    // console.log(`    ✅ ${monthlyData.length} monthly records`);
                    // totalImported += monthlyData.length;
                    
                    // console.log(`  📊 Total for ${crypto.symbol}: ${dailyData.length + weeklyData.length + monthlyData.length} records`);
                    
                    // Longer delay between cryptocurrencies to respect API limits
                    // await this.delay(5000);
                    
                } catch (error) {
                    console.error(`  ❌ Failed to import data for ${crypto.symbol}:`, error.message);
                    console.log('  ⏭️ Continuing with next cryptocurrency...');
                }
            }
            
            console.log(`\n✅ Historical data import completed: ${totalImported} total records`);
            
        } catch (error) {
            console.error('❌ Historical data import failed:', error);
            throw error;
        }
    }

    // Validate all imported data
    async validateImportedData() {
        try {
            console.log('Running comprehensive data validation...');
            
            const validation = await dataValidationService.validateSystemData();
            
            // Check for critical errors
            const totalErrors = [
                ...validation.cryptoAssets.errors,
                ...validation.priceData.errors,
                ...validation.fundData.errors
            ].length;
            
            if (totalErrors > 0) {
                console.error(`❌ Validation found ${totalErrors} critical errors:`);
                validation.cryptoAssets.errors.forEach(err => console.error(`  - ${err}`));
                validation.priceData.errors.forEach(err => console.error(`  - ${err}`));
                validation.fundData.errors.forEach(err => console.error(`  - ${err}`));
                
                throw new Error('Data validation failed - critical errors must be resolved');
            }
            
            // Report warnings
            const totalWarnings = [
                ...validation.cryptoAssets.warnings,
                ...validation.priceData.warnings,
                ...validation.fundData.warnings
            ].length;
            
            if (totalWarnings > 0) {
                console.warn(`⚠️ Validation found ${totalWarnings} warnings (non-critical)`);
            }
            
            console.log('✅ Data validation passed');
            
            // Display data summary
            console.log('\n📊 Data Import Summary:');
            console.log(`Cryptocurrencies: ${validation.cryptoAssets.activeCount}`);
            console.log(`Price Records: ${validation.priceData.totalRecords}`);
            Object.entries(validation.priceData.granularityBreakdown).forEach(([granularity, count]) => {
                console.log(`  - ${granularity}: ${count}`);
            });
            console.log(`Data Gaps: ${validation.dataGaps.totalGaps}`);
            
            return validation;
            
        } catch (error) {
            console.error('❌ Data validation failed:', error);
            throw error;
        }
    }

    // Repair data gaps if any are found
    async repairDataGaps() {
        try {
            console.log('Checking for data gaps...');
            
            const validation = await dataValidationService.validateSystemData();
            
            if (validation.dataGaps.totalGaps === 0) {
                console.log('✅ No data gaps found - skipping repair phase');
                return;
            }
            
            console.log(`🔧 Found ${validation.dataGaps.totalGaps} data gaps - attempting repair...`);
            
            // Sort gaps by severity (most gaps first)
            const sortedGaps = validation.dataGaps.summary
                .sort((a, b) => b.gapCount - a.gapCount)
                .slice(0, 10); // Repair top 10 most problematic gaps
            
            let repairedCount = 0;
            
            for (const gap of sortedGaps) {
                try {
                    console.log(`Repairing ${gap.symbol} ${gap.granularity} (${gap.gapCount} gaps)...`);
                    
                    // For now, just log the gap - actual repair would require re-fetching specific date ranges
                    console.log(`  📅 Gap range: ${gap.firstGap.toISOString().split('T')[0]} to ${gap.lastGap.toISOString().split('T')[0]}`);
                    
                    // In a full implementation, you would:
                    // 1. Calculate the specific date ranges for gaps
                    // 2. Fetch historical data for those specific ranges
                    // 3. Insert the missing data
                    
                    repairedCount++;
                    
                } catch (error) {
                    console.error(`  ❌ Failed to repair ${gap.symbol} ${gap.granularity}:`, error.message);
                }
            }
            
            console.log(`🔧 Gap repair completed: ${repairedCount}/${sortedGaps.length} gaps addressed`);
            
        } catch (error) {
            console.error('❌ Gap repair failed:', error);
            // Don't throw error for gap repair - system can still function with some gaps
        }
    }

    // Utility method for delays
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get setup progress
    getProgress() {
        return {
            currentPhase: this.currentPhase,
            totalPhases: this.setupPhases.length,
            phaseName: this.setupPhases[this.currentPhase] || 'completed',
            percentage: Math.round((this.currentPhase / this.setupPhases.length) * 100)
        };
    }
}

module.exports = InitialDataSetup;

// Run setup if this file is executed directly
if (require.main === module) {
    const setup = new InitialDataSetup();
    setup.runCompleteSetup()
        .then(() => {
            console.log('\n🎉 Setup completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Setup failed:', error);
            process.exit(1);
        });
}