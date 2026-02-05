#!/bin/bash

# Script to setup admin user and reset database
echo "🚀 Setting up admin user for Wizplay..."

# Navigate to auth service
cd apps/auth_service

# Run auth seeders
echo "📝 Running auth service seeders..."
npx sequelize-cli db:seed:all

# Navigate to user service  
cd ../user_service

# Run user seeders
echo "👤 Running user service seeders..."
npx sequelize-cli db:seed:all

echo "✅ Admin user setup complete!"
echo ""
echo "🔑 Admin Login Credentials:"
echo "Email: admin@wizplay.com" 
echo "Username: super_admin_007"
echo "Password: admin123 (you'll need to set this manually or use the encoded one)"
echo ""
echo "💡 To get an admin token, login via the admin panel or use the auth API endpoint:"
echo "POST /auth/login with { email: 'admin@wizplay.com', password: 'your_password' }"