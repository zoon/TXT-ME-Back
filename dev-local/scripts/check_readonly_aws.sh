#!/usr/bin/env bash

set -u

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-north-1}}"

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI not found in PATH. Install AWS CLI and try again." >&2
  exit 127
fi

failures=0

divider() {
  printf '%s\n' "------------------------------------------------------------"
}

run_cmd() {
  local label="$1"
  local cmd="$2"

  printf '%s\n' "$label"
  if bash -c "$cmd" >/dev/null 2>&1; then
    printf '%s\n' "OK"
  else
    printf '%s\n' "FAIL"
    failures=$((failures + 1))
  fi
  divider
}

divider
printf '%s\n' "Read-only AWS checks (region: $REGION)"
divider

run_cmd "STS: get caller identity" \
  "aws sts get-caller-identity"

run_cmd "DynamoDB: list tables" \
  "aws dynamodb list-tables --region '$REGION'"

run_cmd "DynamoDB: describe CMS-Users" \
  "aws dynamodb describe-table --table-name 'CMS-Users' --region '$REGION'"

run_cmd "DynamoDB: describe CMS-Posts" \
  "aws dynamodb describe-table --table-name 'CMS-Posts' --region '$REGION'"

run_cmd "DynamoDB: describe CMS-Comments" \
  "aws dynamodb describe-table --table-name 'CMS-Comments' --region '$REGION'"

run_cmd "Lambda: list functions" \
  "aws lambda list-functions --region '$REGION'"

run_cmd "CloudWatch Logs: describe log groups" \
  "aws logs describe-log-groups --region '$REGION'"

# run_cmd "S3: list bucket" \
#   "aws s3 ls 's3://txt-me.club/'"

run_cmd "CloudFront: list distributions" \
  "aws cloudfront list-distributions"

run_cmd "API Gateway: get REST APIs" \
  "aws apigateway get-rest-apis --region '$REGION'"

run_cmd "IAM: get current user" \
  "aws iam get-user"

if [ "$failures" -eq 0 ]; then
  printf '%s\n' "All read-only checks passed."
  exit 0
fi

printf '%s\n' "$failures check(s) failed."
exit 1
