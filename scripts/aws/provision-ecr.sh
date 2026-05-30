#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-sa-east-1}"

required_vars=(
  AWS_REGION
  ECR_REPOSITORY_API
  ECR_REPOSITORY_WEB
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: ${var_name}"
    exit 1
  fi
done

ensure_repo() {
  local repo_name="$1"
  if aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$repo_name" >/dev/null 2>&1; then
    echo "ECR repository already exists: $repo_name"
  else
    aws ecr create-repository \
      --region "$AWS_REGION" \
      --repository-name "$repo_name" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability IMMUTABLE >/dev/null
    echo "ECR repository created: $repo_name"
  fi
}

ensure_repo "$ECR_REPOSITORY_API"
ensure_repo "$ECR_REPOSITORY_WEB"
