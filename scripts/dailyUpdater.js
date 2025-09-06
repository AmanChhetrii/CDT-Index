#!/usr/bin/env node
// scripts/dailyUpdater.js - Daily cryptocurrency price and NAV update script
require('dotenv').config();
const mongoose = require('mongoose');
const schedulerService = require('../services/schedulerService');

class DailyUpdater {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 6 * 60 * 60 * 1000; // 6 hours
    }

    async run() {
        try {
            console.log('=== CDT Index Daily Update ===');
            console.log(`Started at: ${new Date().toISOString()}`);
            
            await this.connectToDatabase();
            
            await this.runDailyUpdateWithRetry();
            
            console.log('=== Daily Update Completed Successfully ===');
            
        } catch (error) {
            console.error('Daily update failed after all retries:', error);
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

    async runDailyUpdateWithRetry() {
        let attempt = 1;
        
        while (attempt <= this.maxRetries) {
            try {
                console.log(`Update attempt ${attempt}/${this.maxRetries}`);
                
                await schedulerService.runTaskManually('dailyUpdate');
                
                console.log('Daily update completed successfully');
                return;
                
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error.message);
                
                if (attempt === this.maxRetries) {
                    throw new Error(`Daily update failed after ${this.maxRetries} attempts: ${error.message}`);
                }
                
                console.log(`Waiting 6 hours before retry attempt ${attempt + 1}...`);
                await this.delay(this.retryDelay);
                attempt++;
            }
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run updater if this file is executed directly
if (require.main === module) {
    const updater = new DailyUpdater();
    updater.run();
}

module.exports = DailyUpdater;