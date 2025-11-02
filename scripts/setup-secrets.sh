#!/bin/bash

# Google Cloud Secret Manager Setup Script
# This script uploads all environment variables from .env.production to Secret Manager

set -e

PROJECT_ID="${1:-$(gcloud config get-value project)}"
ENV_FILE=".env.production"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID not set. Please provide it as first argument or set default project."
  echo "Usage: ./scripts/setup-secrets.sh YOUR_PROJECT_ID"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found!"
  exit 1
fi

echo "Setting up secrets in project: $PROJECT_ID"
echo "Reading from: $ENV_FILE"
echo ""

# Enable Secret Manager API
echo "Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project="$PROJECT_ID"

# Function to create or update secret
create_or_update_secret() {
  local key=$1
  local value=$2
  
  # Check if secret exists
  if gcloud secrets describe "$key" --project="$PROJECT_ID" &>/dev/null; then
    echo "Updating existing secret: $key"
    echo -n "$value" | gcloud secrets versions add "$key" \
      --data-file=- \
      --project="$PROJECT_ID"
  else
    echo "Creating new secret: $key"
    echo -n "$value" | gcloud secrets create "$key" \
      --data-file=- \
      --replication-policy="automatic" \
      --project="$PROJECT_ID"
  fi
}

# Parse .env.production and create secrets
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Skip empty lines
  [[ -z "$key" ]] && continue
  
  # Skip comments
  [[ "$key" =~ ^[[:space:]]*# ]] && continue
  
  # Skip section headers (lines with just ====)
  [[ "$key" =~ ^[[:space:]]*=+ ]] && continue
  
  # Trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  
  # Skip if key is empty after trimming
  [[ -z "$key" ]] && continue
  
  # Skip if value is empty (optional secrets)
  if [[ -z "$value" ]]; then
    echo "Skipping empty value for: $key"
    continue
  fi
  
  # Create or update the secret
  create_or_update_secret "$key" "$value"
  
done < "$ENV_FILE"

echo ""
echo "✅ Secrets setup completed!"
echo ""
echo "To grant Cloud Run services access to secrets, run:"
echo "  gcloud projects add-iam-policy-binding $PROJECT_ID \\"
echo "    --member='serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com' \\"
echo "    --role='roles/secretmanager.secretAccessor'"
echo ""
echo "To list all secrets:"
echo "  gcloud secrets list --project=$PROJECT_ID"
