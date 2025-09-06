#!/usr/bin/env node
// scripts/gapChecker.js - Standalone data gap detection and reporting
require('dotenv').config();
const mongoose = require('mongoose');
const dataValidationService = require('../services/dataValidationService');

class GapChecker {
    constructor() {
        this.reportFormat = 'console'; // 'console' or 'json'
    }

    async run() {
        try {
            console.log('=== CDT Index Data Gap Checker ===');
            
            await this.connectToDatabase();
            
            const validation = await dataValidationService.validateSystemData();
            
            this.generateGapReport(validation.dataGaps);
            
            console.log('\n=== Gap Check Completed ===');
            
        } catch (error) {
            console.error('Gap checker failed:', error);
            process.exit(1);
        } finally {
            await mongoose.disconnect();
        }
    }

    async connectToDatabase() {
        try {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex');
            console.log('Connected to MongoDB');
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }

    generateGapReport(gapData) {
        console.log('\n=== Data Gap Report ===');
        
        if (gapData.totalGaps === 0) {
            console.log('No data gaps found - system data is complete!');
            return;
        }
        
        console.log(`Total gaps found: ${gapData.totalGaps}`);
        console.log('\nBreakdown by cryptocurrency:');
        
        Object.entries(gapData.cryptoGaps).forEach(([symbol, granularityGaps]) => {
            const totalForCrypto = Object.values(granularityGaps).reduce((sum, count) => sum + count, 0);
            
            if (totalForCrypto > 0) {
                console.log(`\n${symbol}: ${totalForCrypto} total gaps`);
                Object.entries(granularityGaps).forEach(([granularity, count]) => {
                    if (count > 0) {
                        console.log(`  ${granularity}: ${count} gaps`);
                    }
                });
            }
        });
        
        if (gapData.summary.length > 0) {
            console.log('\nMost problematic gaps:');
            gapData.summary
                .sort((a, b) => b.gapCount - a.gapCount)
                .slice(0, 10)
                .forEach(gap => {
                    console.log(`  ${gap.symbol} ${gap.granularity}: ${gap.gapCount} gaps`);
                    console.log(`    Range: ${gap.firstGap.toISOString().split('T')[0]} to ${gap.lastGap.toISOString().split('T')[0]}`);
                });
        }
        
        console.log('\nRecommendations:');
        if (gapData.totalGaps > 100) {
            console.log('- High number of gaps detected. Consider re-running historical data import.');
        } else if (gapData.totalGaps > 20) {
            console.log('- Moderate gaps detected. Run gap repair for most problematic cryptocurrencies.');
        } else {
            console.log('- Minor gaps detected. System should function normally.');
        }
    }
}

// Run gap checker if this file is executed directly
if (require.main === module) {
    const checker = new GapChecker();
    checker.run();
}

module.exports = GapChecker;