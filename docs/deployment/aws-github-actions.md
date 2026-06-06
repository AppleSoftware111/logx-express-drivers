# AWS + GitHub Actions Deployment Runbook

This runbook documents the production deployment path for:
- `apps/api` (Node/Express API on ECS Fargate)
- `apps/web` (Next.js standalone on ECS Fargate)

## 1) Immediate Security Action

The AWS access key pair was exposed in chat and must be treated as compromised.

Perform these actions before first deployment:
1. Deactivate and delete the exposed key pair in IAM.
2. Create a dedicated CI IAM user (programmatic access only, no console password).
3. Attach least-privilege policy from `infra/aws/iam/github-actions-ci-policy.json` after replacing account/resource placeholders.
4. Create a fresh key pair and store it only in GitHub Secrets.

## 2) GitHub Environments

Create two GitHub Environments:
- `staging`
- `production`

Recommended:
- Require manual reviewers for `production`.
- Restrict deploy workflow to protected branches.

## 3) GitHub Secrets and Variables

### Required Secrets
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY`  

### Required Variables
- `AWS_REGION` = `sa-east-1`
- `ECS_CLUSTER`
- `ECS_SERVICE_API`
- `ECS_SERVICE_WEB`
- `ECS_CONTAINER_API` (default `api`)
- `ECS_CONTAINER_WEB` (default `web`)
- `ECR_REPOSITORY_API` (default `logx-api`)
- `ECR_REPOSITORY_WEB` (default `logx-web`)
- `NEXT_PUBLIC_API_URL`
- `CLOUDFRONT_DISTRIBUTION_ID` = `ECN1RSCDU3H3U`
- `S3_BUCKET_NAME` = `my-website-bucket`

## 4) AWS Runtime Preparation

Use `aws-cli` with a privileged operator profile (not CI user) for one-time setup.

### 4.1 Create/ensure ECR repositories
```bash
export AWS_REGION=sa-east-1
export ECR_REPOSITORY_API=logx-api
export ECR_REPOSITORY_WEB=logx-web

bash scripts/aws/provision-ecr.sh
```

### 4.2 Verify runtime resources exist
```bash
export AWS_REGION=sa-east-1
export ECR_REPOSITORY_API=logx-api
export ECR_REPOSITORY_WEB=logx-web
export ECS_CLUSTER=<your-cluster>
export ECS_SERVICE_API=<your-api-service>
export ECS_SERVICE_WEB=<your-web-service>
export S3_BUCKET_NAME=my-website-bucket
export CLOUDFRONT_DISTRIBUTION_ID=ECN1RSCDU3H3U

bash scripts/aws/check-runtime.sh
```

### 4.3 ECS service conventions
Ensure API and Web ECS services have:
- Existing task definitions with container names matching `ECS_CONTAINER_API` / `ECS_CONTAINER_WEB`.
- Execution role and task role configured.
- CloudWatch logs enabled.
- Health checks:
  - API: `GET /health`
  - Web: `GET /`

## 5) Workflows Included

- `.github/workflows/ci.yml`
  - Runs on PRs and pushes (`main`, `develop`).
  - Quality gates: lint, type-check, build.
  - Includes `gitleaks` secret scanning.

- `.github/workflows/deploy-aws.yml`
  - Runs on `main` push or manual dispatch.
  - Builds and pushes API/Web images to ECR.
  - Updates ECS task definitions by replacing container images with immutable SHA tags.
  - Waits for service stabilization.
  - Invalidates CloudFront cache if configured.

## 6) Staging and Production Cutover

### Stage 1: Dry run
- Open PR and confirm `CI` workflow passes.
- Trigger `Deploy AWS` manually to `staging`.

### Stage 2: Staging verification checklist
- API health endpoint responds: `/health`.
- Web login succeeds through the ECS web load balancer and API calls work.
- S3 upload flow works from app.
- Locale switching (`pt`, `es`, `en`) works in web.
- CloudFront serves updated web content.

### Stage 3: Production rollout
- Merge to protected `main`.
- Trigger production deployment with required approvals.
- Monitor ECS service events and CloudWatch logs.

### Stage 4: Rollback
If needed:
1. Identify previous stable task definition revision for each service.
2. Run:
   ```bash
   aws ecs update-service \
     --cluster <cluster> \
     --service <service> \
     --task-definition <previous-task-def-arn>
   ```
3. Wait for service stabilization and validate app health.

## 7) Operational Notes

- Prefer immutable tags (`${GITHUB_SHA}`) already used in deploy workflow.
- Keep IAM policy least-privilege and scoped to specific resources.
- Enable billing alarms and CloudTrail in the AWS account.
- Rotate CI keys periodically and on any suspected exposure.
