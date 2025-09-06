#!/usr/bin/env node
// test/systemTest.js - Complete system functionality test
require('dotenv').config();
const mongoose = require('mongoose');
const { seedDatabase } = require('../seeds/newSeedData');
const cryptoDataService = require('../services/cryptoDataService');
const navCalculationService = require('../services/navCalculationService');
const dataValidationService = require('../services/dataValidationService');

class SystemTest {
    constructor() {
        this.testResults = [];
    }

    async runAllTests() {
        try {
            console.log('=== CDT Index Complete System Test ===');
            console.log('This will test the entire redesigned system functionality\n');
            
            await this.connectToDatabase();
            
            // Test 1: Database seeding
            await this.testDatabaseSeeding();
            
            // Test 2: Current price fetching
            await this.testPriceFetching();
            
            // Test 3: Data validation
            await this.testDataValidation();
            
            // Test 4: NAV calculations
            await this.testNAVCalculations();
            
            // Test 5: System readiness
            await this.testSystemReadiness();
            
            this.displayTestResults();
            
        } catch (error) {
            console.error('System test failed:', error);
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

    async testDatabaseSeeding() {
        try {
            console.log('\nTest 1: Database Seeding');
            console.log('========================');
            
            const { funds, cryptos } = await seedDatabase();
            
            const expectedCryptos = 7;
            const expectedFunds = 4;
            
            if (cryptos.length === expectedCryptos && funds.length === expectedFunds) {
                this.recordTestResult('Database Seeding', true, `${cryptos.length} cryptos, ${funds.length} funds`);
            } else {
                this.recordTestResult('Database Seeding', false, `Expected ${expectedCryptos} cryptos and ${expectedFunds} funds, got ${cryptos.length} and ${funds.length}`);
            }
            
        } catch (error) {
            this.recordTestResult('Database Seeding', false, error.message);
        }
    }

    async testPriceFetching() {
        try {
            console.log('\nTest 2: Price Fetching');
            console.log('=====================');
            
            const priceData = await cryptoDataService.fetchCurrentPrices();
            
            if (Array.isArray(priceData) && priceData.length === 7) {
                const validPrices = priceData.filter(p => p.price > 0);
                if (validPrices.length === 7) {
                    this.recordTestResult('Price Fetching', true, `All 7 cryptocurrencies have valid prices`);
                } else {
                    this.recordTestResult('Price Fetching', false, `Only ${validPrices.length}/7 cryptos have valid prices`);
                }
            } else {
                this.recordTestResult('Price Fetching', false, `Expected 7 price records, got ${priceData?.length || 0}`);
            }
            
        } catch (error) {
            this.recordTestResult('Price Fetching', false, error.message);
        }
    }

    async testDataValidation() {
        try {
            console.log('\nTest 3: Data Validation');
            console.log('======================');
            
            const validation = await dataValidationService.validateSystemData();
            
            const totalErrors = [
                ...validation.cryptoAssets.errors,
                ...validation.priceData.errors,
                ...validation.fundData.errors,
                ...validation.navData.errors
            ].length;
            
            if (totalErrors === 0) {
                this.recordTestResult('Data Validation', true, 'No critical errors found');
            } else {
                this.recordTestResult('Data Validation', false, `${totalErrors} critical errors found`);
            }
            
        } catch (error) {
            this.recordTestResult('Data Validation', false, error.message);
        }
    }

    async testNAVCalculations() {
        try {
            console.log('\nTest 4: NAV Calculations');
            console.log('=======================');
            
            const today = new Date();
            const results = await navCalculationService.calculateNAVForDate(today);
            
            const successfulCalculations = results.filter(r => r.success);
            
            if (successfulCalculations.length === 4) {
                this.recordTestResult('NAV Calculations', true, 'All 4 funds calculated successfully');
                
                // Display calculated NAVs
                console.log('Fund NAVs calculated:');
                successfulCalculations.forEach(result => {
                    console.log(`  ${result.fundSymbol}: $${result.nav.toFixed(4)}`);
                });
            } else {
                this.recordTestResult('NAV Calculations', false, `Only ${successfulCalculations.length}/4 funds calculated successfully`);
            }
            
        } catch (error) {
            this.recordTestResult('NAV Calculations', false, error.message);
        }
    }

    async testSystemReadiness() {
        try {
            console.log('\nTest 5: System Readiness');
            console.log('=======================');
            
            const readiness = await dataValidationService.validateSystemReadiness();
            
            if (readiness.ready) {
                this.recordTestResult('System Readiness', true, 'System is ready for production');
            } else {
                this.recordTestResult('System Readiness', false, `${readiness.blockers.length} blockers: ${readiness.blockers.join(', ')}`);
            }
            
        } catch (error) {
            this.recordTestResult('System Readiness', false, error.message);
        }
    }

    recordTestResult(testName, passed, details) {
        this.testResults.push({
            test: testName,
            passed,
            details
        });
        
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status}: ${testName} - ${details}`);
    }

    displayTestResults() {
        console.log('\n=== Test Results Summary ===');
        
        const passedTests = this.testResults.filter(r => r.passed);
        const failedTests = this.testResults.filter(r => !r.passed);
        
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`Passed: ${passedTests.length}`);
        console.log(`Failed: ${failedTests.length}`);
        
        if (failedTests.length > 0) {
            console.log('\nFailed Tests:');
            failedTests.forEach(test => {
                console.log(`  - ${test.test}: ${test.details}`);
            });
        }
        
        if (passedTests.length === this.testResults.length) {
            console.log('\n🎉 All tests passed! System is ready for use.');
        } else {
            console.log('\n⚠️ Some tests failed. Please resolve issues before proceeding.');
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const test = new SystemTest();
    test.runAllTests();
}

module.exports = SystemTest;