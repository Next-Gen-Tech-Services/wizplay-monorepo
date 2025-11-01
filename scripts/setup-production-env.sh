#!/bin/bash

# ========================================
# Production Environment Setup Script
# ========================================
# This script helps update production environment files
# with production-appropriate values

REPO_ROOT="/Users/ankitchawda/Desktop/NGTS/wizplay-monorepo"

echo "🚀 Updating Production Environment Files..."
echo ""

# Function to update env file
update_env_production() {
    local service=$1
    local env_file="$REPO_ROOT/apps/$service/.env.production"
    
    if [ -f "$env_file" ]; then
        echo "📝 Updating $service..."
        
        # Update NODE_ENV to production
        sed -i '' 's/NODE_ENV = development/NODE_ENV = production/g' "$env_file"
        
        # Update LOG_LEVEL to info for production
        sed -i '' 's/LOG_LEVEL = debug/LOG_LEVEL = info/g' "$env_file"
        
        # Comment out localhost and suggest Docker service names
        sed -i '' 's/DATABASE_HOST = localhost/# DATABASE_HOST = localhost (for local)\nDATABASE_HOST = auth_db_server # (for Docker)/g' "$env_file" 2>/dev/null
        
        echo "   ✅ Updated $service/.env.production"
    else
        echo "   ⚠️  $env_file not found"
    fi
}

# Update all services
for service in auth_service user_service match_service coupon_service contest_service wallet_service; do
    update_env_production "$service"
done

# Special handling for gateway service
echo "📝 Updating gateway_service..."
GATEWAY_ENV="$REPO_ROOT/apps/gateway_service/.env.production"
if [ -f "$GATEWAY_ENV" ]; then
    # Keep LOG_LEVEL as info for gateway
    sed -i '' 's/LOG_LEVEL=debug/LOG_LEVEL=info/g' "$GATEWAY_ENV"
    echo "   ✅ Updated gateway_service/.env.production"
fi

echo ""
echo "✅ Production environment files updated!"
echo ""
echo "⚠️  NEXT STEPS:"
echo "1. Review each .env.production file"
echo "2. Update database hosts for your production servers"
echo "3. Update Redis, RabbitMQ, and Kafka URLs"
echo "4. Generate new strong secrets and tokens"
echo "5. Configure production API keys (OpenAI, MSG91, etc.)"
echo "6. Update service URLs if using Docker Compose"
echo ""
echo "📁 Files updated:"
echo "   - apps/auth_service/.env.production"
echo "   - apps/user_service/.env.production"
echo "   - apps/match_service/.env.production"
echo "   - apps/coupon_service/.env.production"
echo "   - apps/contest_service/.env.production"
echo "   - apps/wallet_service/.env.production"
echo "   - apps/gateway_service/.env.production"
