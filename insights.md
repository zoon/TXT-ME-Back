# Engineering Insights

## 2026-01-14: Notifications module exploration

- Decision: Documented existing notification system (3 Lambda handlers) rather than implementing new
- Gotcha: Directory name typos - "NotoficationsSendEmail", "NotofocationsPostsStream" (missing letters)
- Pattern: DynamoDB Streams → Lambda (async invocation) → SES pipeline for event-driven notifications
- Notes:
  - Infrastructure incomplete: Streams not configured in Terraform
  - Stream handlers have no package.json files
  - Parent comment lookup is O(n) - queries all comments on post, then filters in memory
