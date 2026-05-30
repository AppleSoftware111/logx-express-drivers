#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-sa-east-1}"
S3_BUCKET_NAME="${S3_BUCKET_NAME:-my-website-bucket}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-ECN1RSCDU3H3U}"

required_vars=(
  AWS_REGION
  ECR_REPOSITORY_API
  ECR_REPOSITORY_WEB
  ECS_CLUSTER
  ECS_SERVICE_API
  ECS_SERVICE_WEB
  S3_BUCKET_NAME
  CLOUDFRONT_DISTRIBUTION_ID
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: ${var_name}"
    exit 1
  fi
done

echo "Checking ECR repositories..."
aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$ECR_REPOSITORY_API" >/dev/null
aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$ECR_REPOSITORY_WEB" >/dev/null
echo "ECR repositories found."

echo "Checking ECS cluster and services..."
aws ecs describe-clusters --region "$AWS_REGION" --clusters "$ECS_CLUSTER" \
  --query "clusters[0].status" --output text | grep -E "ACTIVE|PROVISIONING" >/dev/null
aws ecs describe-services --region "$AWS_REGION" --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE_API" "$ECS_SERVICE_WEB" \
  --query "services[*].status" --output text >/dev/null
echo "ECS cluster/services found."

echo "Checking S3 bucket..."
aws s3api head-bucket --bucket "$S3_BUCKET_NAME" --region "$AWS_REGION" >/dev/null
echo "S3 bucket found."

echo "Checking CloudFront distribution..."
aws cloudfront get-distribution --id "$CLOUDFRONT_DISTRIBUTION_ID" >/dev/null
echo "CloudFront distribution found."

echo "Runtime check complete."
