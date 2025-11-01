# Quick Reference Guide

Quick commands and references for Wizplay Monorepo.

## 🚀 Quick Start Commands

```bash
# Clone and setup
git clone <repo-url>
cd wizplay-monorepo
pnpm install

# Start development
pnpm run dev

# Build for production
pnpm run build

# Deploy with Docker
pnpm run docker:prod:up
```

## 📦 Common Commands

### Development

```bash
pnpm run dev              # Start all services
pnpm run build            # Build all services
pnpm run lint             # Lint code
pnpm run format           # Format code
pnpm run check-types      # Type check
```

### Service-Specific

```bash
pnpm --filter auth_service dev      # Run auth service only
pnpm --filter user_service build    # Build user service only
pnpm --filter match_service start   # Start match service in prod mode
```

### Docker Production

```bash
pnpm run docker:prod:build    # Build images
pnpm run docker:prod:up       # Start containers
pnpm run docker:prod:down     # Stop containers
pnpm run docker:prod:logs     # View logs
```

### Docker Development

```bash
docker-compose up                  # Start all
docker-compose up auth_service     # Start specific service
docker-compose down                # Stop all
docker-compose logs -f             # View logs
docker-compose ps                  # Check status
```

## 🔌 Service Ports

| Service | Dev Port | Description |
|---------|----------|-------------|
| Gateway | 8000 | API Gateway |
| Auth | 4001 | Authentication |
| User | 4002 | User Management |
| Match | 4003 | Matches |
| Coupon | 4004 | Coupons |
| Contest | 4005 | Contests |
| Wallet | 4006 | Wallet |

## 🗄️ Database Ports

| Database | Port | Service |
|----------|------|---------|
| auth_db | 5434 | Auth Service |
| user_db | 5436 | User Service |
| match_db | 5435 | Match Service |
| coupon_db | 5437 | Coupon Service |
| contest_db | 5438 | Contest Service |

## 📁 Important Files

```
.env.production              # Universal production config
.env.production.example      # Production template
docker-compose.yaml          # Development Docker
docker-compose.prod.yaml     # Production Docker
turbo.json                   # Turborepo config
```

## 🔧 Environment Setup

### Development
Each service has `.env.development` - already configured!

### Production
```bash
cp .env.production.example .env.production
nano .env.production
# Update: TOKEN_SECRET, passwords, API keys, URLs
```

## 🐳 Docker Quick Reference

### Build
```bash
docker-compose build              # Dev
docker-compose -f docker-compose.prod.yaml build  # Prod
```

### Start
```bash
docker-compose up -d              # Dev (background)
docker-compose -f docker-compose.prod.yaml up -d  # Prod (background)
```

### Logs
```bash
docker-compose logs -f <service>  # Follow logs
docker-compose logs --tail=100    # Last 100 lines
```

### Cleanup
```bash
docker-compose down -v            # Stop and remove volumes
docker system prune -a            # Clean all unused
```

## 💾 Database Access

```bash
# Auth DB
docker exec -it auth_db_server psql -U auth_db -d auth_service

# User DB
docker exec -it user_db_server psql -U user_db -d user_service

# Match DB
docker exec -it match_db_server psql -U match_db -d match_service
```

## 🔍 Debugging

### Check Service Status
```bash
# Docker
docker-compose ps
docker ps

# PM2 (server deployment)
pm2 status
pm2 logs <service-name>
```

### View Logs
```bash
# Development
pnpm --filter <service> dev

# Docker
docker-compose logs -f <service>

# Production (PM2)
pm2 logs <service-name>
```

### Restart Service
```bash
# Docker
docker-compose restart <service>

# PM2
pm2 restart <service-name>
```

## 🚨 Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -ti:4001

# Kill process
kill -9 $(lsof -ti:4001)
```

### Clean Build
```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
rm -rf apps/*/dist packages/*/dist
pnpm install
pnpm run build
```

### Docker Issues
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## 📚 Documentation Links

- [README.md](./README.md) - Main documentation
- [PRODUCTION.md](./PRODUCTION.md) - Production deployment
- [ENV_UNIVERSAL.md](./ENV_UNIVERSAL.md) - Environment config
- [ENVIRONMENT.md](./ENVIRONMENT.md) - All environment variables

## 🔐 Security Checklist

Before production:
- [ ] Generate new `TOKEN_SECRET`
- [ ] Update all database passwords
- [ ] Add `OPENAI_API_KEY`
- [ ] Update SMTP credentials
- [ ] Update MSG91 credentials
- [ ] Update OAuth client IDs
- [ ] Update `CLIENT_HOST` to production domain
- [ ] Set up SSL/TLS
- [ ] Configure firewall rules

## 🎯 Production Deployment Checklist

- [ ] Set up `.env.production`
- [ ] Update all secrets and passwords
- [ ] Build production images: `pnpm run docker:prod:build`
- [ ] Start services: `pnpm run docker:prod:up`
- [ ] Verify health checks
- [ ] Set up reverse proxy (Nginx)
- [ ] Configure SSL certificates
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Test all endpoints

## 💡 Tips

1. **Use filters** for faster development: `pnpm --filter <service> dev`
2. **Check Turbo cache** for build optimization
3. **Use Docker** for consistent environments
4. **Monitor logs** during deployment
5. **Keep .env files secure** - never commit to Git

## 🆘 Getting Help

1. Check logs: `docker-compose logs -f <service>`
2. Review environment variables
3. Verify database connections
4. Check service health endpoints
5. Review service-specific README (if exists)

---

**Quick tip:** Keep this file handy for daily development!
