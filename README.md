# Wizplay Monorepo

A production-ready microservices monorepo built with Turborepo, TypeScript, and Node.js.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Available Scripts](#available-scripts)
- [Documentation](#documentation)

## 🎯 Overview

Wizplay is a microservices-based platform consisting of multiple backend services and a gateway, all managed in a Turborepo monorepo.

## 🏗️ Architecture

This monorepo includes the following services:

### Microservices

| Service | Port | Description |
|---------|------|-------------|
| **gateway_service** | 8000 | API Gateway and proxy for all services |
| **auth_service** | 4001 | Authentication and authorization |
| **user_service** | 4002 | User management and profiles |
| **match_service** | 4003 | Match data and operations |
| **coupon_service** | 4004 | Coupon management |
| **contest_service** | 4005 | Contest operations |
| **wallet_service** | 4006 | Wallet and transactions |

### Packages

- `@repo/common` - Shared utilities and types
- `@repo/typescript-config` - Shared TypeScript configurations

### Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5.9
- **Package Manager:** pnpm 9.0
- **Build System:** Turborepo 2.5
- **Database:** PostgreSQL 15
- **Cache:** Redis
- **Message Queue:** RabbitMQ, Kafka
- **Containerization:** Docker & Docker Compose

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18 (LTS recommended)
- **pnpm** >= 9.0.0
- **Docker** and **Docker Compose** (for containerized development/deployment)
- **Git**

### Install pnpm

```bash
npm install -g pnpm@9.0.0
```

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Next-Gen-Tech-Services/wizplay-monorepo.git
cd wizplay-monorepo
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

```bash
# Development (already configured)
# Each service has .env.development files

# Production (for deployment)
cp .env.production.example .env.production
# Edit .env.production with your production values
```

### 4. Start Development Environment

```bash
# Option 1: Run all services locally
pnpm run dev

# Option 2: Run with Docker
docker-compose up
```

Your services will be available at:
- Gateway: http://localhost:8000
- Auth Service: http://localhost:4001
- User Service: http://localhost:4002
- Match Service: http://localhost:4003
- Coupon Service: http://localhost:4004
- Contest Service: http://localhost:4005
- Wallet Service: http://localhost:4006

## 💻 Development

### Project Structure

```
wizplay-monorepo/
├── apps/
│   ├── gateway_service/       # API Gateway
│   ├── auth_service/          # Authentication
│   ├── user_service/          # User management
│   ├── match_service/         # Match operations
│   ├── coupon_service/        # Coupon management
│   ├── contest_service/       # Contest operations
│   └── wallet_service/        # Wallet & transactions
├── packages/
│   ├── common/                # Shared utilities
│   └── typescript-config/     # Shared TS configs
├── database/
│   └── init/                  # Database initialization scripts
├── scripts/
│   └── setup-production-env.sh
├── .env.production            # Universal production environment
├── docker-compose.yaml        # Development Docker setup
├── docker-compose.prod.yaml   # Production Docker setup
└── turbo.json                 # Turborepo configuration
```

### Development Workflow

#### Run All Services

```bash
# Run all services in development mode
pnpm run dev
```

#### Run Specific Service

```bash
# Using pnpm filter
pnpm --filter auth_service dev

# Or navigate to service directory
cd apps/auth_service
pnpm dev
```

#### Build All Services

```bash
# Build all services (compiles TypeScript to JavaScript)
pnpm run build
```

#### Build Specific Service

```bash
pnpm --filter auth_service build
```

#### Type Checking

```bash
# Check types across all services
pnpm run check-types
```

#### Linting

```bash
# Lint all services
pnpm run lint
```

#### Code Formatting

```bash
# Format all code with Prettier
pnpm run format
```

### Docker Development

```bash
# Start all services with Docker
docker-compose up

# Start specific service
docker-compose up auth_service

# Rebuild and start
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service_name]
```

### Hot Reload

All services use `ts-node-dev` for automatic reloading during development. Changes to TypeScript files will automatically restart the service.

## 🚢 Production Deployment

### Option 1: Docker Deployment (Recommended)

#### 1. Set Up Production Environment

```bash
# Copy and edit the universal production environment file
cp .env.production.example .env.production
nano .env.production
```

**Required Updates:**
- Generate new `TOKEN_SECRET`: `openssl rand -hex 32`
- Update all database passwords
- Add `OPENAI_API_KEY`
- Update `CLIENT_HOST` to your production domain
- Update SMTP, MSG91, and OAuth credentials

#### 2. Build Production Images

```bash
pnpm run docker:prod:build
```

This builds optimized multi-stage Docker images for all services.

#### 3. Deploy

```bash
# Start all services in production mode
pnpm run docker:prod:up

# View logs
pnpm run docker:prod:logs

# Stop services
pnpm run docker:prod:down
```

#### 4. Health Checks

Services include health check endpoints:

```bash
# Check auth service
curl http://localhost:4001/health

# Check gateway
curl http://localhost:8000/health
```

### Option 2: Server Deployment (Without Docker)

#### 1. Set Up Environment

```bash
# On your production server
cp .env.production.example .env.production
nano .env.production

# Update for server deployment (not Docker)
# Change service hosts from Docker names to actual IPs
```

#### 2. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

#### 3. Build Services

```bash
pnpm run build
```

This compiles all TypeScript to JavaScript in `dist/` folders.

#### 4. Start Services with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start all services
pm2 start apps/auth_service/dist/server.js --name auth-service
pm2 start apps/user_service/dist/server.js --name user-service
pm2 start apps/match_service/dist/server.js --name match-service
pm2 start apps/coupon_service/dist/server.js --name coupon-service
pm2 start apps/contest_service/dist/server.js --name contest-service
pm2 start apps/wallet_service/dist/server.js --name wallet-service
pm2 start apps/gateway_service/dist/index.js --name gateway-service

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

#### 5. Set Up Reverse Proxy (Nginx)

```nginx
# /etc/nginx/sites-available/wizplay
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site and restart nginx
sudo ln -s /etc/nginx/sites-available/wizplay /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. Set Up SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## ⚙️ Environment Configuration

### Universal Environment File

All services share a single `.env.production` file at the root level:

```bash
.env.production                 # Universal configuration for all services
```

**Key Variables:**

```bash
# Security
TOKEN_SECRET=your-secret-here

# Databases (all services)
AUTH_DATABASE_HOST=auth_db_server
USER_DATABASE_HOST=user_db_server
# ... etc

# External Services
REDIS_HOST=your-redis-host
RABBITMQ_URL=your-rabbitmq-url
KAF_BROKERS=kafka:9094

# API Keys
OPENAI_API_KEY=your-key
MSG91_AUTH_KEY=your-key

# Frontend
CLIENT_HOST=https://your-domain.com
```

**Learn More:**
- See [ENV_UNIVERSAL.md](./ENV_UNIVERSAL.md) for detailed configuration
- See [ENVIRONMENT.md](./ENVIRONMENT.md) for all environment variables

### Service-Specific Configuration

Each service can override universal settings with its own `.env.production` file:

```bash
apps/auth_service/.env.production    # Auth-specific overrides (optional)
apps/user_service/.env.production    # User-specific overrides (optional)
```

## 📜 Available Scripts

### Root Level Scripts

```bash
# Development
pnpm run dev                    # Start all services in dev mode
pnpm run build                  # Build all services
pnpm run start                  # Run all services in production mode
pnpm run lint                   # Lint all services
pnpm run format                 # Format code with Prettier
pnpm run check-types            # Type check all services

# Docker Production
pnpm run docker:prod:build      # Build production Docker images
pnpm run docker:prod:up         # Start production containers
pnpm run docker:prod:down       # Stop production containers
pnpm run docker:prod:logs       # View production logs
```

### Service-Specific Scripts

```bash
# Run commands for specific service
pnpm --filter <service-name> <command>

# Examples:
pnpm --filter auth_service dev
pnpm --filter user_service build
pnpm --filter match_service start
```

### Database Scripts

```bash
# Access database containers
docker exec -it auth_db_server psql -U auth_db -d auth_service
docker exec -it user_db_server psql -U user_db -d user_service
```

## 📚 Documentation

- **[PRODUCTION.md](./PRODUCTION.md)** - Complete production deployment guide
- **[ENV_UNIVERSAL.md](./ENV_UNIVERSAL.md)** - Universal environment configuration
- **[ENVIRONMENT.md](./ENVIRONMENT.md)** - Detailed environment variables reference
- **[docker-compose.yaml](./docker-compose.yaml)** - Development Docker setup
- **[docker-compose.prod.yaml](./docker-compose.prod.yaml)** - Production Docker setup

## 🛠️ Development Tools

### TypeScript

All services use TypeScript 5.9 with strict mode enabled.

### ESLint & Prettier

Code quality and formatting are maintained with ESLint and Prettier.

### Turborepo

Turborepo provides:
- Fast incremental builds
- Build caching
- Parallel execution
- Task pipelines

### Docker

Multi-stage Dockerfiles for:
- Small production images
- Fast builds
- Security (non-root users)

## 🔧 Troubleshooting

### Build Issues

```bash
# Clear all build outputs
rm -rf apps/*/dist apps/*/build packages/*/dist

# Clear node_modules and reinstall
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install

# Force rebuild
pnpm run build --force
```

### Service Won't Start

1. Check environment variables are set
2. Verify database is running and accessible
3. Check logs: `pnpm --filter <service> dev`
4. Ensure port is not already in use

### Docker Issues

```bash
# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up

# View logs
docker-compose logs -f <service-name>

# Clean Docker
docker system prune -a
```

### Database Connection Issues

1. Check database is running: `docker-compose ps`
2. Verify credentials in `.env` files
3. Ensure database host is correct (Docker vs localhost)
4. Check network connectivity

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting: `pnpm run lint`
4. Build to verify: `pnpm run build`
5. Submit a pull request

## 📄 License

ISC

## 🔗 Useful Links

### Turborepo
- [Documentation](https://turborepo.com/docs)
- [Running Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)

### Docker
- [Docker Compose](https://docs.docker.com/compose/)
- [Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)

## 📞 Support

For issues and questions:
- Create an issue in the GitHub repository
- Contact the development team

---

**Built with ❤️ by Next-Gen-Tech-Services**
