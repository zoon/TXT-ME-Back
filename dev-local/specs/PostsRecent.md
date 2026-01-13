# PostsRecent

Fetches posts and comments created since a given timestamp. Used for real-time/polling updates.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-PostsRecent` |
| **Handler** | `posts/PostsRecent/index.mjs` |
| **Runtime** | Node.js (ES Modules) |
| **HTTP Method** | GET |
| **Authentication** | None (public endpoint) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-dynamodb` | DynamoDB client |
| `@aws-sdk/lib-dynamodb` | Document client wrapper |

## Request

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `since` | string | Yes | Cutoff timestamp - ISO 8601 or milliseconds |

**Accepted formats:**
- ISO 8601: `2026-01-05T12:00:00Z`
- Milliseconds: `1704456000000`

### Example URLs
```
GET /posts/recent?since=2026-01-05T12:00:00Z
GET /posts/recent?since=1704456000000
```

## Response

### 200 OK - Success
```json
{
  "success": true,
  "since": "2026-01-05T12:00:00.000Z",
  "sinceTimestamp": 1704456000000,
  "now": "2026-01-05T12:05:00.000Z",
  "nowTimestamp": 1704456300000,
  "newPosts": [
    {
      "postId": "uuid",
      "userId": "uuid",
      "username": "string",
      "title": "string",
      "content": "string",
      "tags": ["tagId"],
      "createdAt": 1704456100000,
      "updatedAt": 1704456100000,
      "commentCount": 0,
      "postAvatarId": "string|null"
    }
  ],
  "newComments": [
    {
      "commentId": "uuid",
      "postId": "uuid",
      "userId": "uuid",
      "username": "string",
      "content": "string",
      "createdAt": 1704456200000,
      "parentCommentId": "uuid|null",
      "commentAvatarId": "string|null"
    }
  ],
  "summary": {
    "totalNewPosts": 1,
    "totalNewComments": 1
  }
}
```

### 400 Bad Request - Missing Parameter
```json
{
  "error": "Missing 'since' parameter",
  "example": "?since=2026-01-05T12:00:00Z or ?since=1704456000000"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "error message"
}
```

## Database Access

### Tables Scanned

| Table | Operation | Filter |
|-------|-----------|--------|
| CMS-Posts | Full Scan | `createdAt > sinceTimestamp` (in-memory) |
| CMS-Comments | Full Scan | `createdAt > sinceTimestamp` (in-memory) |

**Note:** Both tables are fully scanned, then filtered in application code.

## Flow

```
1. Parse `since` query parameter
2. Convert to millisecond timestamp (detect ISO vs numeric)
3. Scan entire CMS-Posts table
4. Filter posts where createdAt > cutoffTimestamp
5. Scan entire CMS-Comments table
6. Filter comments where createdAt > cutoffTimestamp
7. Sort both arrays oldest-first
8. Return with timing metadata
```

## Sorting

Results are sorted **oldest first** (ascending by `createdAt`):
- Allows client to process items in chronological order
- Client can use `nowTimestamp` as next `since` value for polling

## Polling Pattern

```javascript
// Client-side polling example
let lastCheck = Date.now();

async function pollForUpdates() {
  const response = await fetch(`/posts/recent?since=${lastCheck}`);
  const data = await response.json();

  if (data.newPosts.length || data.newComments.length) {
    // Process new items...
  }

  lastCheck = data.nowTimestamp; // Use server time for next poll
}

setInterval(pollForUpdates, 5000); // Poll every 5 seconds
```

## Performance Considerations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Full table scans | High read capacity usage | Add `createdAt-index` GSI with Query |
| No pagination | Memory issues with large result sets | Add `limit` parameter |
| Two sequential scans | Latency doubles | Parallelize with `Promise.all` |
| In-memory filtering | Wasted read capacity | Use FilterExpression in Scan |

**Current implementation scales poorly beyond ~1000 items per table.**

## CORS Headers

```json
{
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
}
```

## Example

### Request
```bash
curl "https://api.example.com/posts/recent?since=2026-01-05T12:00:00Z"
```

### Response
```json
{
  "success": true,
  "since": "2026-01-05T12:00:00.000Z",
  "sinceTimestamp": 1704456000000,
  "now": "2026-01-05T12:05:32.123Z",
  "nowTimestamp": 1704456332123,
  "newPosts": [],
  "newComments": [
    {
      "commentId": "abc-123",
      "postId": "post-456",
      "userId": "user-789",
      "username": "alice",
      "content": "Great post!",
      "createdAt": 1704456100000,
      "parentCommentId": null,
      "commentAvatarId": null
    }
  ],
  "summary": {
    "totalNewPosts": 0,
    "totalNewComments": 1
  }
}
```

## Related Functions

| Function | Relationship |
|----------|--------------|
| PostCreate | Creates posts returned by this function |
| CommentCreate | Creates comments returned by this function |
| PostsList | Alternative for paginated post listing (no time filter) |
