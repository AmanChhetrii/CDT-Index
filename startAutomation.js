// startAutomation.js - Start the automatic scheduler
require('dotenv').config();
const mongoose = require('mongoose');
const automaticScheduler = require('./services/automaticScheduler');

async function startAutomaticSystem() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Start the automatic scheduler
        await automaticScheduler.start();

        console.log('\nAutomatic data management system is now running...');
        console.log('- Single daily job handles all tasks');
        console.log('- Includes downtime resilience for weekly/monthly sampling');
        console.log('Press Ctrl+C to stop');

        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\nShutting down automatic scheduler...');
            automaticScheduler.stop();
            await mongoose.disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('Failed to start automatic system:', error);
        process.exit(1);
    }
}

// Allow manual testing
if (process.argv[2] === 'test') {
    mongoose.connect(process.env.MONGODB_URI).then(async () => {
        console.log('Running manual test...');
        await automaticScheduler.runTasksManually();
        await mongoose.disconnect();
        process.exit(0);
    });
} else {
    startAutomaticSystem();
}