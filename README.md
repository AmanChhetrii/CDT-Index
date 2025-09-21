# CDT Index - Cryptocurrency Index Fund Platform

A sophisticated web-based platform for cryptocurrency index fund investments featuring automated data management, real-time NAV calculations, and comprehensive portfolio tracking.

## Project Overview

CDT Index is a full-stack financial technology platform that enables users to invest in professionally managed cryptocurrency index funds. The system features automated daily data processing, sophisticated mathematical calculations for Net Asset Value (NAV), and a complete investment management infrastructure.


## Project Structure

```
cdt-index/
├── app.js                     # Main Express server
├── package.json               # Dependencies & scripts
├── .env                       # Environment variables
├── manualDataFetch.js         # Manual data processing
├── startAutomation.js         # Automated system
│
├── models/                    # Database schemas
│   ├── User.js               # User authentication
│   ├── Fund.js               # Investment funds
│   ├── CryptoAsset.js        # Cryptocurrency data
│   ├── CryptoPrice.js        # Price history
│   ├── NAV.js                # Fund NAV history
│   ├── ROI.js                # Portfolio tracking
│   └── Transaction.js        # Transaction records
│
├── routes/                    # Route handlers
│   ├── landing.js            # Public pages
│   ├── auth.js               # Authentication
│   └── dashboard.js          # Protected dashboard
│
├── services/                  # Business logic
│   ├── automaticScheduler.js # Automated data processing
│   ├── fundService.js        # Fund management
│   ├── walletService.js      # Wallet operations
│   ├── investmentService.js  # Investment logic
│   └── chartService.js       # Chart data
│
├── middleware/                # Custom middleware
│   └── auth.js               # Authentication middleware
│
├── views/                     # EJS templates
│   ├── landing/              # Public pages
│   ├── auth/                 # Login/signup
│   └── dashboard/            # User interface
│
└── public/                   # Static assets
    ├── dashboard/            # Dashboard assets
    └── css/, js/, img/       # Landing page assets
```

## Technical Architecture

### Backend Infrastructure
- **Node.js & Express.js** - RESTful API server with session-based authentication
- **MongoDB & Mongoose** - Document database with optimized schemas and indexing
- **Automated Data Pipeline** - Scheduled tasks using node-cron for daily operations
- **External API Integration** - CryptoCompare API for real-time cryptocurrency data
- **Email Services** - Nodemailer integration for password reset and notifications

### Frontend Technology
- **EJS Templating** - Server-side rendering with dynamic content
- **Kaiadmin Dashboard** - Professional admin template with responsive design
- **Bootstrap Framework** - Mobile-first responsive UI components
- **Custom Glassmorphism Design** - Modern visual aesthetics for landing pages
- **Interactive Charts** - Real-time data visualization for fund performance

### Security & Authentication
- **bcryptjs Password Hashing** - Secure user credential storage
- **Session Management** - MongoDB-backed sessions with configurable expiration
- **Password Reset System** - OTP-based email verification with rate limiting
- **Route Protection Middleware** - Authentication guards for protected resources

## Fund Management System

### Active Index Funds

**CDT Growth Index (CDTGR)**
- Risk Level: Conservative Growth
- Inception NAV: $120.00
- Composition: BTC 60%, ETH 25%, SOL 15%

**CDT Balanced Index (CDTBAL)**
- Risk Level: Stable Growth  
- Inception NAV: $100.00
- Composition: BTC 30%, ETH 30%, AVAX 20%, LINK 20%

**CDT Pioneer Index (CDTPIO)**
- Risk Level: High Risk Alternative
- Inception NAV: $90.00
- Composition: DOGE 50%, MANA 35%, AVAX 15%

**CDT AmanRC Index (CDTARC)**
- Risk Level: Premium Diversified
- Inception NAV: $150.00
- Composition: BTC 40%, ETH 25%, SOL 20%, LINK 15%

## Technical Features

### Automated Data Management
- **Daily Price Fetching** - Scheduled collection from 7 cryptocurrencies at 2:00 PM IST
- **NAV Calculation Engine** - Mathematical computation using weighted price ratios
- **Data Granularity System** - Daily (90-day rolling), Weekly, and Monthly data retention
- **Intelligent Substitution Logic** - Handles missing cryptocurrency data with predefined rules
- **Rolling Window Maintenance** - Automatic cleanup of expired daily data

### Database Architecture
```
Collections:
├── Users - Authentication and profile management
├── Funds - Index fund configurations and metadata  
├── CryptoAssets - Supported cryptocurrency information
├── CryptoPrice - Historical price data (multi-granularity)
├── NAV - Fund Net Asset Value history and performance
├── ROI - User portfolio value tracking over time
├── Transactions - Complete investment transaction records
└── PasswordReset - Secure password reset token management
```

### NAV Calculation Algorithm
- **Weighted Price Ratio Method** - `NAV(t) = Inception NAV × Σ wi × Pi(t)/Pi(0)`
- **Substitution Rules** - Automatic fallback for unavailable cryptocurrencies
- **Performance Metrics** - Daily change, total return, and percentage calculations
- **Historical Tracking** - Complete NAV history with multiple time granularities

### Investment Management
- **Portfolio Tracking** - Real-time portfolio valuation and performance
- **Transaction Processing** - Buy/sell operations with NAV price recording
- **Cash Management** - Digital wallet with deposit/withdrawal capabilities
- **Performance Analytics** - ROI calculation and historical performance tracking

## API Architecture

### Public Endpoints
- Fund information and current NAV data
- Historical performance charts and metrics
- Fund composition and risk level information

### Protected Dashboard APIs
- User portfolio summary and holdings
- Transaction history with filtering and pagination
- Investment operations (buy/sell fund units)
- Account management and profile updates

### Data Processing APIs
- Real-time fund performance calculations
- Portfolio value history for charting
- Transaction export functionality

## System Automation

### Daily Operations (Automated)
1. **Cryptocurrency Price Collection** - API calls to CryptoCompare
2. **NAV Calculation Processing** - Mathematical computation for all funds
3. **User ROI Updates** - Portfolio value recalculation for all users
4. **Data Maintenance** - Cleanup of expired daily records
5. **Weekly Sampling** - Tuesday data archival to weekly granularity
6. **Monthly Sampling** - First-of-month data archival to monthly granularity

### Data Quality & Resilience
- **API Failure Handling** - Graceful degradation with error logging
- **Missed Schedule Recovery** - Catch-up logic for system downtime
- **Data Validation** - Input sanitization and mathematical constraint checking
- **Performance Optimization** - Efficient database queries and indexing

## User Interface Features

### Dashboard Components
- **Portfolio Overview** - Real-time valuation and performance metrics
- **Fund Explorer** - Interactive fund comparison and analysis
- **Transaction Management** - Complete history with search and export
- **Profile Management** - Account settings and avatar upload
- **Performance Charts** - Historical data visualization

### Landing Page Design
- **Modern Glassmorphism UI** - Contemporary visual design patterns
- **Responsive Layout** - Mobile-optimized experience
- **Fund Showcase** - Interactive fund information display
- **Contact Integration** - Professional inquiry management system

## Technical Specifications

### Performance Optimizations
- **Database Indexing** - Compound indexes for efficient queries
- **Data Aggregation** - Optimized statistical calculations
- **Session Management** - Scalable user state persistence
- **File Handling** - Efficient avatar upload and storage

### Scalability Features
- **Modular Architecture** - Separated business logic services
- **API Rate Limiting** - External service usage optimization
- **Data Archival Strategy** - Efficient long-term data storage
- **Error Handling** - Comprehensive logging and monitoring

## Project Statistics

- **4 Active Index Funds** with distinct investment strategies
- **7 Supported Cryptocurrencies** (BTC, ETH, SOL, AVAX, DOGE, LINK, MANA)
- **Multi-granularity Data** - Daily, weekly, and monthly historical records
- **Automated Daily Processing** - Scheduled at 2:00 PM IST
- **90-day Rolling Window** - Efficient daily data management
- **Complete Transaction History** - Full audit trail with CSV export

---

**Technology Stack:** Node.js, Express.js, MongoDB, Mongoose, EJS, Bootstrap, bcryptjs, node-cron, nodemailer

**Development Status:** Production-ready backend with comprehensive automated data management and professional dashboard interface