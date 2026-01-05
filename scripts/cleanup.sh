#!/bin/bash

# WizPlay Database Cleanup Script
# Cleans all application data while preserving user accounts

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DRY_RUN=false
AUTO_CONFIRM=false
USE_SQL=false
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  --dry-run         Show what would be cleaned without making changes"
    echo "  --confirm         Skip confirmation prompt"
    echo "  --sql             Use SQL script method instead of Node.js"
    echo "  --host HOST       Database host (default: localhost)"
    echo "  --port PORT       Database port (default: 5432)"
    echo "  --user USER       Database user (default: postgres)"
    echo "  --help            Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 --dry-run                    # Preview what would be cleaned"
    echo "  $0 --confirm                    # Clean without confirmation"
    echo "  $0 --sql --host prod-db         # Use SQL script on production host"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --confirm)
            AUTO_CONFIRM=true
            shift
            ;;
        --sql)
            USE_SQL=true
            shift
            ;;
        --host)
            DB_HOST="$2"
            shift 2
            ;;
        --port)
            DB_PORT="$2"
            shift 2
            ;;
        --user)
            DB_USER="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Print header
echo -e "${BLUE}"
echo "🗂️  WizPlay Database Cleanup Script"
echo "====================================="
echo -e "${NC}"

# Check if we're in the right directory
if [[ ! -f "database-cleanup.js" ]]; then
    print_error "database-cleanup.js not found. Please run this script from the scripts directory."
    exit 1
fi

# Load environment variables if .env.production exists
if [[ -f ".env.production" ]]; then
    print_info "Loading environment variables from .env.production"
    set -a  # Mark all new/modified variables for export
    source .env.production
    set +a  # Stop marking variables for export
elif [[ -f "../.env" ]]; then
    print_info "Loading environment variables from ../.env"
    set -a
    source ../.env
    set +a
else
    print_warning "No .env.production or .env file found. Using default values."
fi

# Show configuration
print_info "Configuration:"
echo "  Database Host: $DB_HOST"
echo "  Database Port: $DB_PORT" 
echo "  Database User: $DB_USER"
echo "  Dry Run: $DRY_RUN"
echo "  Auto Confirm: $AUTO_CONFIRM"
echo "  Use SQL: $USE_SQL"
echo ""

# Warn about data loss
if [[ "$DRY_RUN" != "true" ]]; then
    print_warning "This script will DELETE transactional data from your database!"
    print_warning "USER ACCOUNTS and MATCH/TOURNAMENT DATA will be PRESERVED"
    print_warning "CONTEST PARTICIPATION and OTHER TRANSACTIONAL DATA will be REMOVED"
    echo ""
fi

# Check dependencies
if [[ "$USE_SQL" == "true" ]]; then
    if ! command -v psql &> /dev/null; then
        print_error "psql command not found. Please install PostgreSQL client tools."
        exit 1
    fi
else
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found. Installing dependencies..."
        npm init -y
        npm install sequelize pg
    fi
    
    if [[ ! -d "node_modules" ]]; then
        print_info "Installing Node.js dependencies..."
        npm install
    fi
fi

# Ask for confirmation unless auto-confirmed or dry run
if [[ "$DRY_RUN" != "true" && "$AUTO_CONFIRM" != "true" ]]; then
    echo -e "${YELLOW}Are you sure you want to proceed? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_warning "Cleanup cancelled by user"
        exit 0
    fi
fi

# Set environment variables for database connection
export DB_HOST="$DB_HOST"
export DB_PORT="$DB_PORT" 
export DB_USER="$DB_USER"

# Run the appropriate cleanup method
if [[ "$USE_SQL" == "true" ]]; then
    print_info "Using SQL script method..."
    
    # List of databases to clean - use environment variable names if available
    DATABASES=(
        "${AUTH_DATABASE_NAME:-auth_service}" 
        "${USER_DATABASE_NAME:-user_service}" 
        "${MATCH_DATABASE_NAME:-match_service}" 
        "${CONTEST_DATABASE_NAME:-contest_service}" 
        "${COUPON_DATABASE_NAME:-coupon_service}" 
        "${NOTIFICATION_DATABASE_NAME:-notification_service}" 
        "${WALLET_DATABASE_NAME:-wallet_service}"
    )
    
    for db in "${DATABASES[@]}"; do
        print_info "Processing database: $db"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            print_info "DRY RUN: Would execute SQL cleanup on $db"
        else
            # Check if database exists
            if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$db"; then
                print_info "Executing cleanup on $db..."
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db" -f database-cleanup.sql
                print_success "Completed cleanup on $db"
            else
                print_warning "Database $db not found, skipping..."
            fi
        fi
    done
    
else
    print_info "Using Node.js script method..."
    
    # Build node command arguments
    NODE_ARGS=()
    if [[ "$DRY_RUN" == "true" ]]; then
        NODE_ARGS+=("--dry-run")
    fi
    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        NODE_ARGS+=("--confirm") 
    fi
    
    # Run the Node.js cleanup script
    node database-cleanup.js "${NODE_ARGS[@]}"
fi

# Final message
echo ""
if [[ "$DRY_RUN" == "true" ]]; then
    print_success "Dry run completed! No changes were made."
else
    print_success "Database cleanup completed successfully!"
    print_info "User accounts, authentication data, and match/tournament data have been preserved."
    print_info "All contest participation, live events, and transactional data has been removed."
fi

echo ""
print_info "Next steps:"
echo "  - Restart your application services"
echo "  - Verify the application works with clean data"
echo "  - Import new match/contest data if needed"
echo ""