# Google Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud Project Setup**
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   gcloud config set compute/region us-central1
   ```

2. **Enable Required APIs**
   ```bash
   gcloud services enable \
     run.googleapis.com \
     cloudbuild.googleapis.com \
     containerregistry.googleapis.com \
     sqladmin.googleapis.com \
     secretmanager.googleapis.com \
     redis.googleapis.com
   ```

## Infrastructure Setup

### 1. Cloud SQL (PostgreSQL)

Create Cloud SQL instances for your databases:

```bash
# Create a single PostgreSQL instance with multiple databases
gcloud sql instances create wizplay-postgres \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1 \
  --network=default \
  --no-assign-ip \
  --enable-bin-log

# Create databases
gcloud sql databases create auth_service --instance=wizplay-postgres
gcloud sql databases create user_service --instance=wizplay-postgres
gcloud sql databases create match_service --instance=wizplay-postgres
gcloud sql databases create coupon_service --instance=wizplay-postgres
gcloud sql databases create contest_service --instance=wizplay-postgres
gcloud sql databases create wallet_service --instance=wizplay-postgres

# Create database users
gcloud sql users create auth_db --instance=wizplay-postgres --password=YOUR_PASSWORD
gcloud sql users create user_db --instance=wizplay-postgres --password=YOUR_PASSWORD
gcloud sql users create match_db --instance=wizplay-postgres --password=YOUR_PASSWORD
gcloud sql users create coupon_db --instance=wizplay-postgres --password=YOUR_PASSWORD
gcloud sql users create contest_db --instance=wizplay-postgres --password=YOUR_PASSWORD
gcloud sql users create wallet_db --instance=wizplay-postgres --password=YOUR_PASSWORD
```

**Alternative (Cost-Effective):** Use a single database with different schemas or use [Neon](https://neon.tech/), [Supabase](https://supabase.com/), or [Railway](https://railway.app/) for PostgreSQL.

### 2. Cloud Memorystore (Redis)

```bash
gcloud redis instances create wizplay-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

**Alternative:** Use your existing Redis Cloud instance (already configured in .env.production).

### 3. Pub/Sub or Confluent Cloud (Kafka Alternative)

For event streaming, you have two options:

**Option A: Google Cloud Pub/Sub** (Recommended for Cloud Run)
```bash
# Create topics
gcloud pubsub topics create user-events
gcloud pubsub topics create match-events
gcloud pubsub topics create wallet-events
gcloud pubsub topics create contest-events

# Create subscriptions
gcloud pubsub subscriptions create user-events-sub --topic=user-events
gcloud pubsub subscriptions create match-events-sub --topic=match-events
```

**Option B: Confluent Cloud** (Keep Kafka)
- Sign up at https://confluent.cloud/
- Create a Kafka cluster
- Update KAF_BROKERS in environment

### 4. Secret Manager

Store sensitive environment variables:

```bash
# Create secrets
echo -n "your-token-secret" | gcloud secrets create TOKEN_SECRET --data-file=-
echo -n "/cloudsql/PROJECT_ID:REGION:wizplay-postgres" | gcloud secrets create AUTH_DATABASE_HOST --data-file=-
echo -n "auth_service" | gcloud secrets create AUTH_DATABASE_NAME --data-file=-
echo -n "auth_db" | gcloud secrets create AUTH_DATABASE_USERNAME --data-file=-
echo -n "YOUR_PASSWORD" | gcloud secrets create AUTH_DATABASE_PASSWORD --data-file=-
echo -n "5432" | gcloud secrets create AUTH_DATABASE_PORT --data-file=-

# Repeat for each service (USER, MATCH, COUPON, CONTEST, WALLET)
```

## Deployment

### Option 1: Using Cloud Build (Automated)

1. **Connect GitHub Repository**
   ```bash
   gcloud builds submit --config=cloudbuild.yaml
   ```

2. **Set up CI/CD Trigger**
   - Go to Cloud Build > Triggers
   - Create trigger for `dev` branch
   - Use `cloudbuild.yaml`

### Option 2: Manual Deployment

```bash
# Build and push each service
docker build -t gcr.io/YOUR_PROJECT_ID/auth-service:latest -f apps/auth_service/dockerfile.prod .
docker push gcr.io/YOUR_PROJECT_ID/auth-service:latest

# Deploy to Cloud Run
gcloud run deploy auth-service \
  --image=gcr.io/YOUR_PROJECT_ID/auth-service:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=4001 \
  --add-cloudsql-instances=YOUR_PROJECT_ID:us-central1:wizplay-postgres \
  --set-env-vars=NODE_ENV=production,PORT=4001 \
  --set-secrets=AUTH_DATABASE_HOST=AUTH_DATABASE_HOST:latest,AUTH_DATABASE_NAME=AUTH_DATABASE_NAME:latest

# Repeat for each service
```

### Option 3: Quick Deploy Script

Create `deploy-cloud-run.sh`:

```bash
#!/bin/bash

PROJECT_ID="your-project-id"
REGION="us-central1"
SERVICES=("auth" "user" "match" "coupon" "contest" "wallet" "gateway")
PORTS=("4001" "4002" "4003" "4004" "4005" "4006" "8000")

for i in "${!SERVICES[@]}"; do
  SERVICE="${SERVICES[$i]}"
  PORT="${PORTS[$i]}"
  
  echo "Deploying ${SERVICE}-service..."
  
  gcloud run deploy ${SERVICE}-service \
    --source=. \
    --region=${REGION} \
    --platform=managed \
    --allow-unauthenticated \
    --port=${PORT}
done
```

## Service Communication

Update gateway service to use Cloud Run URLs:

```javascript
// In .env.production (update after deployment)
AUTH_SERVICE_URL=https://auth-service-xxxxx.run.app
USER_SERVICE_URL=https://user-service-xxxxx.run.app
MATCHES_SERVICE_URL=https://match-service-xxxxx.run.app
COUPONS_SERVICE_URL=https://coupon-service-xxxxx.run.app
CONTEST_SERVICE_URL=https://contest-service-xxxxx.run.app
WALLET_SERVICE_URL=https://wallet-service-xxxxx.run.app
```

## Cost Optimization

1. **Use minimum instances**: Set `--min-instances=0` for dev
2. **CPU allocation**: Use `--cpu-throttling` for services without constant traffic
3. **Memory limits**: Set `--memory=512Mi` for smaller services
4. **Shared database**: Use single Cloud SQL instance with multiple databases
5. **Consider Cloud Run Jobs** for batch processing

## Monitoring

```bash
# View logs
gcloud run services logs read auth-service --region=us-central1

# Set up alerts
# Go to Cloud Console > Monitoring > Alerting
```

## Database Migration

Run migrations using Cloud Run Jobs:

```bash
gcloud run jobs create db-migration \
  --image=gcr.io/YOUR_PROJECT_ID/auth-service:latest \
  --region=us-central1 \
  --add-cloudsql-instances=PROJECT_ID:REGION:wizplay-postgres \
  --command="pnpm,run,migrate" \
  --set-secrets=DATABASE_URL=AUTH_DATABASE_URL:latest

gcloud run jobs execute db-migration
```

## Alternative: Use Google Kubernetes Engine (GKE)

If you need more control and want to keep docker-compose-like orchestration:

```bash
# Create GKE cluster
gcloud container clusters create wizplay-cluster \
  --region=us-central1 \
  --num-nodes=3 \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=10

# Convert docker-compose to Kubernetes with Kompose
kompose convert -f docker-compose.prod.yaml

# Deploy to GKE
kubectl apply -f .
```

## Recommended Approach for Your Stack

Given your microservices architecture with Kafka:

1. **Use GKE Autopilot** instead of Cloud Run for:
   - Better support for stateful services (Kafka, Zookeeper)
   - Service mesh capabilities
   - Lower latency between services

2. **Or Migrate to Managed Services**:
   - Cloud SQL for PostgreSQL ✅
   - Confluent Cloud for Kafka
   - Cloud Memorystore for Redis
   - Cloud Run for microservices

## Next Steps

1. Choose deployment strategy (Cloud Run vs GKE)
2. Set up Cloud SQL instances
3. Configure Secret Manager
4. Update service URLs in environment
5. Run cloudbuild.yaml or deploy manually
6. Set up monitoring and alerts
7. Configure custom domain and SSL

## Support Scripts Needed

Would you like me to create:
1. Terraform scripts for infrastructure?
2. Kubernetes manifests for GKE?
3. Shell scripts for automated deployment?
4. Migration strategy from docker-compose to cloud?
