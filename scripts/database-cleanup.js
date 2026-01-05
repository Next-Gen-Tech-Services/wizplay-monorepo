#!/usr/bin/env node

/**
 * Database Cleanup Script
 * 
 * This script cleans up all application data while preserving user accounts.
 * It connects to each service's database and removes transactional data.
 * 
 * PRESERVED DATA:
 * - User accounts (users table)
 * - Referral relationships
 * - User authentication data
 * - Matches and tournaments
 * 
 * CLEANED DATA:
 * - Contest participations and submissions
 * - Coupons
 * - Notifications
 * - Live match data and events
 * - Wishlists
 * - Contest prizes
 * - Wallet transactions
 * 
 * Usage: node database-cleanup.js [--dry-run] [--confirm]
 */

const { Sequelize, QueryTypes } = require('sequelize');
const readline = require('readline');
const path = require('path');

// Load environment variables
try {
  const fs = require('fs');
  const envPath = path.join(__dirname, '.env.production');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    for (const line of envLines) {
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').replace(/^"|"$/g, ''); // Remove surrounding quotes
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
    console.log('✅ Loaded environment variables from .env.production');
  } else {
    console.log('⚠️  .env.production file not found, using process environment');
  }
} catch (error) {
  console.log('⚠️  Could not load .env.production:', error.message);
}

// Configuration for each service database
const DB_CONFIGS = {
  auth_service: {
    name: process.env.AUTH_DATABASE_NAME || 'auth_service',
    host: process.env.AUTH_DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.AUTH_DATABASE_PORT || process.env.DB_PORT || 5432,
    username: process.env.AUTH_DATABASE_USERNAME || process.env.DB_USER || 'postgres',
    password: process.env.AUTH_DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  },
  user_service: {
    name: process.env.USER_DATABASE_NAME || 'user_service', 
    host: process.env.USER_DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.USER_DATABASE_PORT || process.env.DB_PORT || 5432,
    username: process.env.USER_DATABASE_USERNAME || process.env.DB_USER || 'postgres',
    password: process.env.USER_DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  },
  match_service: {
    name: process.env.MATCH_DATABASE_NAME || 'match_service',
    host: process.env.MATCH_DATABASE_HOST || process.env.DB_HOST || 'localhost', 
    port: process.env.MATCH_DATABASE_PORT || process.env.DB_PORT || 5432,
    username: process.env.MATCH_DATABASE_USERNAME || process.env.DB_USER || 'postgres',
    password: process.env.MATCH_DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  },
  contest_service: {
    name: process.env.CONTEST_DATABASE_NAME || 'contest_service',
    host: process.env.CONTEST_DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.CONTEST_DATABASE_PORT || process.env.DB_PORT || 5432, 
    username: process.env.CONTEST_DATABASE_USERNAME || process.env.DB_USER || 'postgres',
    password: process.env.CONTEST_DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  },
  coupon_service: {
    name: process.env.COUPON_DATABASE_NAME || 'coupon_service',
    host: process.env.COUPON_DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.COUPON_DATABASE_PORT || process.env.DB_PORT || 5432,
    username: process.env.COUPON_DATABASE_USERNAME || process.env.DB_USER || 'postgres', 
    password: process.env.COUPON_DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  },
  notification_service: {
    name: process.env.NOTIFICATION_DATABASE_NAME || 'notification_service',
    host: process.env.NOTIFICATION_DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.NOTIFICATION_DATABASE_PORT || process.env.DB_PORT || 5432,
    username: process.env.NOTIFICATION_DATABASE_USERNAME || process.env.DB_USER || 'postgres',
    password: process.env.NOTIFICATION_DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  },
  wallet_service: {
    name: process.env.WALLET_DATABASE_NAME || 'wallet_service',
    host: process.env.WALLET_DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.WALLET_DATABASE_PORT || process.env.DB_PORT || 5432,
    username: process.env.WALLET_DATABASE_USERNAME || process.env.DB_USER || 'postgres',
    password: process.env.WALLET_DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  }
};

// Tables to clean for each service
const CLEANUP_TABLES = {
  auth_service: [
    // Keep user auth data - don't clean
  ],
  user_service: [
    'wishlists' // Clean wishlists but preserve users and referrals
  ],
  match_service: [
    'match_live_events',
    'match_live_states',
    'wishlists'
    // Remove non-existent tables and preserve matches/tournaments
  ],
  contest_service: [
    'user_submissions',
    'user_contests', 
    'contest_prizes',
    'questions',
    'contests'
  ],
  coupon_service: [
    'user_coupons',
    'coupons'
  ],
  notification_service: [
    'notifications'
    // Remove non-existent notification_templates
  ],
  wallet_service: [
    'wallet_transactions'
    // Note: wallet balances will be reset to zero (preserving wallet records)
  ]
};

class DatabaseCleaner {
  constructor(dryRun = false) {
    this.dryRun = dryRun;
    this.connections = {};
    this.cleanupStats = {};
  }

  async connect() {
    console.log('🔌 Connecting to databases...\n');
    
    for (const [serviceName, config] of Object.entries(DB_CONFIGS)) {
      try {
        const sequelize = new Sequelize({
          dialect: 'postgres',
          database: config.name,
          username: config.username,
          password: config.password,
          host: config.host,
          port: config.port,
          logging: false,
          dialectOptions: {
            ssl: process.env.NODE_ENV === 'production' ? {
              require: true,
              rejectUnauthorized: false
            } : false
          }
        });

        await sequelize.authenticate();
        this.connections[serviceName] = sequelize;
        console.log(`✅ Connected to ${serviceName} (${config.name})`);
        
      } catch (error) {
        console.warn(`⚠️  Could not connect to ${serviceName}: ${error.message}`);
        // Continue with other databases
      }
    }
    console.log('');
  }

  async getTableRowCount(serviceName, tableName) {
    try {
      const sequelize = this.connections[serviceName];
      if (!sequelize) return 0;

      const result = await sequelize.query(
        `SELECT COUNT(*) as count FROM ${tableName}`,
        { type: QueryTypes.SELECT }
      );
      
      return parseInt(result[0].count);
    } catch (error) {
      console.warn(`⚠️  Could not count rows in ${serviceName}.${tableName}: ${error.message}`);
      return 0;
    }
  }

  async cleanTable(serviceName, tableName) {
    try {
      const sequelize = this.connections[serviceName];
      if (!sequelize) {
        console.log(`❌ No connection to ${serviceName}, skipping ${tableName}`);
        return 0;
      }

      const initialCount = await this.getTableRowCount(serviceName, tableName);
      
      if (initialCount === 0) {
        console.log(`⏭️  ${serviceName}.${tableName} is already empty`);
        return 0;
      }

      if (this.dryRun) {
        console.log(`🔍 DRY RUN: Would delete ${initialCount} rows from ${serviceName}.${tableName}`);
        return initialCount;
      }

      // Disable foreign key checks temporarily for easier cleanup
      await sequelize.query('SET session_replication_role = replica;');
      
      const result = await sequelize.query(
        `TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`,
        { type: QueryTypes.RAW }
      );

      // Re-enable foreign key checks
      await sequelize.query('SET session_replication_role = DEFAULT;');
      
      console.log(`✅ Cleaned ${serviceName}.${tableName} (${initialCount} rows deleted)`);
      return initialCount;
      
    } catch (error) {
      console.error(`❌ Error cleaning ${serviceName}.${tableName}: ${error.message}`);
      return 0;
    }
  }

  async resetWalletBalances(serviceName) {
    try {
      const sequelize = this.connections[serviceName];
      if (!sequelize) {
        console.log(`❌ No connection to ${serviceName}, skipping wallet balance reset`);
        return 0;
      }

      // Count wallets with non-zero balances
      const result = await sequelize.query(
        `SELECT COUNT(*) as count FROM wallets WHERE balance > 0 OR deposit_amount > 0 OR winning_amount > 0 OR total_deposited > 0 OR total_withdrawn > 0 OR total_winnings > 0 OR total_referral_earnings > 0`,
        { type: QueryTypes.SELECT }
      );
      
      const affectedCount = parseInt(result[0].count);
      
      if (affectedCount === 0) {
        console.log(`⏭️  All wallet balances are already zero`);
        return 0;
      }

      if (this.dryRun) {
        console.log(`🔍 DRY RUN: Would reset balances for ${affectedCount} wallets to zero`);
        return affectedCount;
      }

      // Reset all balance fields to zero while preserving wallet records
      await sequelize.query(
        `UPDATE wallets SET 
          balance = 0,
          deposit_amount = 0, 
          winning_amount = 0,
          total_deposited = 0,
          total_withdrawn = 0,
          total_winnings = 0,
          total_referral_earnings = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE balance > 0 OR deposit_amount > 0 OR winning_amount > 0 OR total_deposited > 0 OR total_withdrawn > 0 OR total_winnings > 0 OR total_referral_earnings > 0`,
        { type: QueryTypes.UPDATE }
      );
      
      console.log(`✅ Reset wallet balances to zero (${affectedCount} wallets affected)`);
      return affectedCount;
      
    } catch (error) {
      console.error(`❌ Error resetting wallet balances: ${error.message}`);
      return 0;
    }
  }

  async getWalletBalanceStats(serviceName) {
    try {
      const sequelize = this.connections[serviceName];
      if (!sequelize) return 0;

      const result = await sequelize.query(
        `SELECT COUNT(*) as count FROM wallets WHERE balance > 0 OR deposit_amount > 0 OR winning_amount > 0 OR total_deposited > 0 OR total_withdrawn > 0 OR total_winnings > 0 OR total_referral_earnings > 0`,
        { type: QueryTypes.SELECT }
      );
      
      return parseInt(result[0].count);
    } catch (error) {
      console.warn(`⚠️  Could not count wallet balances in ${serviceName}: ${error.message}`);
      return 0;
    }
  }

  async showPreCleanupStats() {
    console.log('📊 Pre-cleanup Database Statistics:\n');
    
    for (const [serviceName, tables] of Object.entries(CLEANUP_TABLES)) {
      if (!this.connections[serviceName] || tables.length === 0) continue;
      
      console.log(`📁 ${serviceName.toUpperCase()}:`);
      let serviceTotal = 0;
      
      for (const tableName of tables) {
        const count = await this.getTableRowCount(serviceName, tableName);
        console.log(`   ${tableName}: ${count.toLocaleString()} rows`);
        serviceTotal += count;
      }

      // Special display for wallet service
      if (serviceName === 'wallet_service') {
        const walletBalances = await this.getWalletBalanceStats(serviceName);
        console.log(`   wallet balances to reset: ${walletBalances.toLocaleString()} wallets`);
        serviceTotal += walletBalances;
      }
      
      console.log(`   TOTAL: ${serviceTotal.toLocaleString()} rows\n`);
      this.cleanupStats[serviceName] = { before: serviceTotal, after: 0 };
    }
  }

  async performCleanup() {
    console.log(this.dryRun ? '🔍 DRY RUN - Simulating cleanup...\n' : '🧹 Starting cleanup...\n');
    
    let totalRowsAffected = 0;

    for (const [serviceName, tables] of Object.entries(CLEANUP_TABLES)) {
      if (!this.connections[serviceName] || tables.length === 0) continue;
      
      console.log(`🗂️  Cleaning ${serviceName}:`);
      let serviceRowsAffected = 0;
      
      for (const tableName of tables) {
        const rowsAffected = await this.cleanTable(serviceName, tableName);
        serviceRowsAffected += rowsAffected;
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Special handling for wallet_service: reset balances to zero
      if (serviceName === 'wallet_service') {
        const walletBalancesAffected = await this.resetWalletBalances(serviceName);
        serviceRowsAffected += walletBalancesAffected;
      }
      
      console.log(`   Service total: ${serviceRowsAffected.toLocaleString()} rows\n`);
      totalRowsAffected += serviceRowsAffected;
      
      if (this.cleanupStats[serviceName]) {
        this.cleanupStats[serviceName].after = serviceRowsAffected;
      }
    }

    return totalRowsAffected;
  }

  async showPostCleanupStats() {
    console.log('\n📊 Post-cleanup Database Statistics:\n');
    
    for (const [serviceName, tables] of Object.entries(CLEANUP_TABLES)) {
      if (!this.connections[serviceName] || tables.length === 0) continue;
      
      console.log(`📁 ${serviceName.toUpperCase()}:`);
      
      for (const tableName of tables) {
        const count = await this.getTableRowCount(serviceName, tableName);
        console.log(`   ${tableName}: ${count.toLocaleString()} rows`);
      }
      console.log('');
    }
  }

  async disconnect() {
    console.log('🔌 Closing database connections...\n');
    
    for (const [serviceName, sequelize] of Object.entries(this.connections)) {
      try {
        await sequelize.close();
        console.log(`✅ Disconnected from ${serviceName}`);
      } catch (error) {
        console.warn(`⚠️  Error disconnecting from ${serviceName}: ${error.message}`);
      }
    }
  }

  printSummary(totalRowsAffected) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    
    if (this.dryRun) {
      console.log(`🔍 DRY RUN: Would have affected ${totalRowsAffected.toLocaleString()} total rows`);
    } else {
      console.log(`✅ Successfully cleaned ${totalRowsAffected.toLocaleString()} total rows`);
    }
    
    console.log('\nPRESERVED DATA:');
    console.log('- ✅ User accounts');
    console.log('- ✅ User authentication data');  
    console.log('- ✅ Referral relationships');
    console.log('- ✅ User wallets (structure)');
    console.log('- ✅ Matches and tournaments');
    
    console.log('\nCLEANED DATA:');
    console.log('- 🧹 Contests and questions');
    console.log('- 🧹 User submissions and contest entries');
    console.log('- 🧹 Coupons and user coupons');
    console.log('- 🧹 Notifications');
    console.log('- 🧹 Live match data and events');
    console.log('- 🧹 Wallet transactions');
    console.log('- 🧹 User wishlists');
    console.log('- 💰 Wallet balances reset to zero');
    
    console.log('\n' + '='.repeat(60));
  }
}

async function askForConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Are you sure you want to proceed with the cleanup? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('🗂️  WizPlay Database Cleanup Script');
  console.log('=====================================\n');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const autoConfirm = args.includes('--confirm');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode - no changes will be made\n');
  }

  const cleaner = new DatabaseCleaner(dryRun);

  try {
    // Connect to databases
    await cleaner.connect();

    // Show current state
    await cleaner.showPreCleanupStats();

    // Ask for confirmation unless auto-confirmed or dry run
    if (!dryRun && !autoConfirm) {
      const confirmed = await askForConfirmation();
      if (!confirmed) {
        console.log('❌ Cleanup cancelled by user');
        await cleaner.disconnect();
        process.exit(0);
      }
      console.log('');
    }

    // Perform cleanup
    const totalRowsAffected = await cleaner.performCleanup();

    // Show final state (only for actual cleanup, not dry run)
    if (!dryRun) {
      await cleaner.showPostCleanupStats();
    }

    // Print summary
    cleaner.printSummary(totalRowsAffected);

    // Disconnect
    await cleaner.disconnect();

    console.log(dryRun ? '\n🔍 Dry run completed!' : '\n✅ Cleanup completed successfully!');

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    console.error(error.stack);
    
    await cleaner.disconnect();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Received interrupt signal, shutting down gracefully...');
  process.exit(0);
});

// Run the script
main().catch(console.error);