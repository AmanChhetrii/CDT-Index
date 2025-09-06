// services/schedulerService.js - Automated task scheduling for daily operations
const cryptoDataService = require('./cryptoDataService');
const navCalculationService = require('./navCalculationService');
const dataValidationService = require('./dataValidationService');

class SchedulerService {
    constructor() {
        this.isRunning = false;
        this.intervals = {};
        this.retryAttempts = 3;
        this.retryDelay = 6 * 60 * 60 * 1000; // 6 hours
    }

    // Start all automated tasks
    startScheduler() {
        if (this.isRunning) {
            console.log('Scheduler is already running');
            return;
        }

        console.log('Starting automated task scheduler...');
        this.isRunning = true;

        // Daily price updates - every day at 6 AM UTC
        this.scheduleTask('dailyPriceUpdate', this.runDailyUpdate.bind(this), '0 6 * * *');

        // Weekly data sampling - every Tuesday at 7 AM UTC
        this.scheduleTask('weeklyDataSampling', this.runWeeklyTasks.bind(this), '0 7 * * 2');

        // Monthly data sampling - first day of month at 8 AM UTC
        this.scheduleTask('monthlyDataSampling', this.runMonthlyTasks.bind(this), '0 8 1 * *');

        // Daily cleanup - every day at 2 AM UTC
        this.scheduleTask('dailyCleanup', this.runCleanupTasks.bind(this), '0 2 * * *');

        // Health check - every 6 hours
        this.scheduleTask('healthCheck', this.runHealthCheck.bind(this), '0 */6 * * *');

        console.log('All scheduled tasks started successfully');
    }

    // Stop all scheduled tasks
    stopScheduler() {
        console.log('Stopping scheduler...');
        
        Object.keys(this.intervals).forEach(taskName => {
            clearInterval(this.intervals[taskName]);
            delete this.intervals[taskName];
        });

        this.isRunning = false;
        console.log('Scheduler stopped');
    }

    // Schedule a task with cron-like syntax (simplified)
    scheduleTask(taskName, taskFunction, cronExpression) {
        // For simplicity, we'll use setTimeout for intervals
        // In production, you'd use a proper cron library like node-cron

        const intervalMs = this.parseCronToInterval(cronExpression);
        
        this.intervals[taskName] = setInterval(async () => {
            try {
                console.log(`Running scheduled task: ${taskName}`);
                await taskFunction();
                console.log(`Completed scheduled task: ${taskName}`);
            } catch (error) {
                console.error(`Error in scheduled task ${taskName}:`, error);
                await this.handleTaskError(taskName, error);
            }
        }, intervalMs);

        console.log(`Scheduled ${taskName} to run every ${intervalMs / 1000 / 60 / 60} hours`);
    }

    // Parse cron expression to interval (simplified)
    parseCronToInterval(cronExpression) {
        // This is a simplified parser - in production use node-cron
        const parts = cronExpression.split(' ');
        
        // Daily tasks (6 AM)
        if (cronExpression.includes('6 * * *')) {
            return 24 * 60 * 60 * 1000; // 24 hours
        }
        
        // Weekly tasks (Tuesday)
        if (cronExpression.includes('* * 2')) {
            return 7 * 24 * 60 * 60 * 1000; // 7 days
        }
        
        // Monthly tasks (1st of month)
        if (cronExpression.includes('1 * *')) {
            return 30 * 24 * 60 * 60 * 1000; // 30 days
        }
        
        // Health check (every 6 hours)
        if (cronExpression.includes('*/6')) {
            return 6 * 60 * 60 * 1000; // 6 hours
        }
        
        // Default to daily
        return 24 * 60 * 60 * 1000;
    }

    // Daily update task (fetch current prices, update NAVs)
    async runDailyUpdate() {
        try {
            console.log('=== Starting Daily Update ===');
            
            // Step 1: Fetch current cryptocurrency prices
            console.log('Fetching current cryptocurrency prices...');
            await cryptoDataService.fetchCurrentPrices();
            
            // Step 2: Calculate and update fund NAVs
            console.log('Calculating fund NAVs...');
            await navCalculationService.updateDailyNAVs();
            
            // Step 3: Sample data for weekly/monthly if appropriate dates
            console.log('Checking for data sampling requirements...');
            await cryptoDataService.sampleDataForGranularity();
            
            console.log('=== Daily Update Completed Successfully ===');
            
        } catch (error) {
            console.error('Daily update failed:', error);
            throw error;
        }
    }

    // Weekly tasks (run every Tuesday)
    async runWeeklyTasks() {
        try {
            console.log('=== Starting Weekly Tasks ===');
            
            // Sample weekly data
            await cryptoDataService.sampleWeeklyData();
            
            // Run comprehensive data validation
            console.log('Running weekly data validation...');
            const validation = await dataValidationService.validateSystemData();
            
            if (validation.dataGaps.totalGaps > 0) {
                console.warn(`Found ${validation.dataGaps.totalGaps} data gaps during weekly check`);
            }
            
            console.log('=== Weekly Tasks Completed ===');
            
        } catch (error) {
            console.error('Weekly tasks failed:', error);
            throw error;
        }
    }

    // Monthly tasks (run on 1st of each month)
    async runMonthlyTasks() {
        try {
            console.log('=== Starting Monthly Tasks ===');
            
            // Sample monthly data
            await cryptoDataService.sampleMonthlyData();
            
            // Generate monthly performance report
            console.log('Generating monthly performance summary...');
            const performance = await navCalculationService.getPerformanceSummary();
            
            console.log('Monthly Performance Summary:');
            performance.forEach(fund => {
                console.log(`${fund.symbol}: $${fund.currentNAV.toFixed(4)} (${fund.totalReturnPercent.toFixed(2)}% total return)`);
            });
            
            console.log('=== Monthly Tasks Completed ===');
            
        } catch (error) {
            console.error('Monthly tasks failed:', error);
            throw error;
        }
    }

    // Cleanup tasks (remove old data, optimize database)
    async runCleanupTasks() {
        try {
            console.log('=== Starting Cleanup Tasks ===');
            
            // Clean up old daily data (keep only 30 days)
            console.log('Cleaning up old daily price data...');
            await cryptoDataService.cleanupOldDailyData(30);
            
            console.log('=== Cleanup Tasks Completed ===');
            
        } catch (error) {
            console.error('Cleanup tasks failed:', error);
            throw error;
        }
    }

    // Health check task
    async runHealthCheck() {
        try {
            console.log('=== Running System Health Check ===');
            
            const readiness = await dataValidationService.validateSystemReadiness();
            
            if (readiness.ready) {
                console.log('✅ System health check passed');
            } else {
                console.warn('⚠️ System health check found issues:');
                readiness.blockers.forEach(blocker => {
                    console.warn(`  - ${blocker}`);
                });
            }
            
        } catch (error) {
            console.error('Health check failed:', error);
            // Don't throw error for health checks
        }
    }

    // Handle task errors with retry logic
    async handleTaskError(taskName, error) {
        try {
            console.error(`Task ${taskName} failed:`, error.message);
            
            // For critical tasks, implement retry logic
            if (this.isCriticalTask(taskName)) {
                console.log(`Scheduling retry for critical task ${taskName} in 6 hours`);
                
                setTimeout(async () => {
                    try {
                        if (taskName === 'dailyPriceUpdate') {
                            await this.runDailyUpdate();
                        }
                        console.log(`Retry successful for task ${taskName}`);
                    } catch (retryError) {
                        console.error(`Retry failed for task ${taskName}:`, retryError.message);
                    }
                }, this.retryDelay);
            }
            
        } catch (handleError) {
            console.error('Error in error handler:', handleError);
        }
    }

    // Check if task is critical and needs retry
    isCriticalTask(taskName) {
        const criticalTasks = ['dailyPriceUpdate'];
        return criticalTasks.includes(taskName);
    }

    // Manual task execution methods
    async runTaskManually(taskName) {
        try {
            console.log(`Manually executing task: ${taskName}`);
            
            switch (taskName) {
                case 'dailyUpdate':
                    await this.runDailyUpdate();
                    break;
                case 'weeklyTasks':
                    await this.runWeeklyTasks();
                    break;
                case 'monthlyTasks':
                    await this.runMonthlyTasks();
                    break;
                case 'cleanup':
                    await this.runCleanupTasks();
                    break;
                case 'healthCheck':
                    await this.runHealthCheck();
                    break;
                default:
                    throw new Error(`Unknown task: ${taskName}`);
            }
            
            console.log(`Manual task execution completed: ${taskName}`);
            
        } catch (error) {
            console.error(`Manual task execution failed for ${taskName}:`, error);
            throw error;
        }
    }

    // Get scheduler status
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeTasks: Object.keys(this.intervals),
            taskCount: Object.keys(this.intervals).length
        };
    }
}

module.exports = new SchedulerService();