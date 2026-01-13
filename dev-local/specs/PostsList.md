# PostsList

Lists all posts with optional tag filtering and cursor-based pagination.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-PostsList` |
| **Handler** | `posts/PostsList/index.mjs` |
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

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `tagId` | string | - | - | Filter posts containing this tag |
| `limit` | number | 20 | 100 | Number of posts per page |
| `lastKey` | string | - | - | URL-encoded pagination cursor |

### Example URLs
```
GET /posts
GET /posts?limit=50
GET /posts?tagId=tech-123
GET /posts?limit=20&lastKey=%7B%22postId%22%3A%22abc%22%7D
```

## Response

### 200 OK
```json
{
  "posts": [
    {
      "postId": "uuid",
      "userId": "uuid",
      "username": "string",
      "title": "string",
      "content": "string",
      "tags": ["tagId1", "tagId2"],
      "createdAt": 1704456000000,
      "updatedAt": 1704456000000,
      "commentCount": 5,
      "postAvatarId": "string|null"
    }
  ],
  "count": 20,
  "nextKey": "encoded-cursor|null"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Database Access

### Table: CMS-Posts

| Scenario | Operation | Notes |
|----------|-----------|-------|
| No filter | ScanCommand | Full table scan |
| With tagId | ScanCommand + FilterExpression | Full scan with filter |

### Filter Expression (when tagId provided)
```
FilterExpression: contains(tags, :tagId)
ExpressionAttributeValues: { ":tagId": tagId }
```

## Flow

```
1. Parse query parameters (tagId, limit, lastKey)
2. Clamp limit to max 100
3. Build scan params with Limit
4. If lastKey provided, decode and set ExclusiveStartKey
5. If tagId provided, add FilterExpression
6. Execute ScanCommand
7. Sort results by createdAt descending (in-memory)
8. Encode LastEvaluatedKey as nextKey
9. Return posts, count, nextKey
```

## Pagination

### Cursor Format
```javascript
// DynamoDB LastEvaluatedKey
{ "postId": "abc-123" }

// URL-encoded for client
"%7B%22postId%22%3A%22abc-123%22%7D"
```

### Client Usage
```javascript
async function fetchAllPosts() {
  let posts = [];
  let nextKey = null;

  do {
    const url = nextKey
      ? `/posts?lastKey=${nextKey}`
      : '/posts';
    const response = await fetch(url);
    const data = await response.json();

    posts = posts.concat(data.posts);
    nextKey = data.nextKey;
  } while (nextKey);

  return posts;
}
```

### Invalid lastKey Handling
```javascript
try {
  params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));
} catch (e) {
  console.error("Invalid lastKey:", e);
  // Silently ignored - starts from beginning
}
```

## Sorting

### Implementation Issue
```javascript
// This has NO effect on ScanCommand
ScanIndexForward: false  // Only works with QueryCommand

// Actual sorting done in-memory
posts.sort((a, b) => b.createdAt - a.createdAt);
```

**Problem:** Scan returns items in arbitrary order, then sorts in-memory. With pagination, this causes:
- Items may appear on multiple pages
- Items may be missed entirely
- Sort order inconsistent across pages

### Correct Approach (not implemented)
Should use `createdAt-index` GSI with QueryCommand for consistent ordering.

## Tag Filtering

### How It Works
```javascript
FilterExpression: "contains(tags, :tagId)"
```

The `tags` field is an array of tag IDs. `contains()` checks array membership.

### Performance Impact
- FilterExpression runs **after** Scan reads items
- Still consumes read capacity for filtered-out items
- With `Limit: 20`, may return fewer than 20 items
- Pagination unreliable with filters

### Example
```
Posts in DB: [A, B, C, D, E] (only B, D have tagId)
Scan Limit: 2

Page 1: Scan reads [A, B], filters → returns [B], nextKey points to C
Page 2: Scan reads [C, D], filters → returns [D], nextKey points to E
Page 3: Scan reads [E], filters → returns [], no nextKey

Result: [B, D] ✓ (works in this case)
```

But with different data distribution, results may be inconsistent.

## Performance Considerations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Full table scan | High read capacity | Use GSI with Query |
| In-memory sort | Memory/CPU usage | Sort at DB level |
| Post-scan filter | Wasted reads | Use GSI for tags |
| Pagination + filter | Inconsistent results | Scan without Limit |

### Scaling Limits

| Posts | Behavior |
|-------|----------|
| < 1000 | Works acceptably |
| 1000-10000 | Slow, high costs |
| > 10000 | May timeout, pagination breaks |

## CORS Headers

```json
{
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-user-id,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
}
```

## Examples

### List All Posts
```bash
curl "https://api.example.com/posts"
```

### With Pagination
```bash
curl "https://api.example.com/posts?limit=10"
# Response includes nextKey

curl "https://api.example.com/posts?limit=10&lastKey=%7B%22postId%22%3A%22xyz%22%7D"
```

### Filter by Tag
```bash
curl "https://api.example.com/posts?tagId=tech-123"
```

## Known Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| ScanIndexForward ignored | Medium | Has no effect on Scan, misleading |
| Pagination with filter | High | May miss items or show duplicates |
| In-memory sorting | Medium | Inconsistent across pages |
| No GSI usage | Medium | Full scans even with createdAt-index available |

## Related Functions

| Function | Relationship |
|----------|--------------|
| PostsGet | Fetch single post by ID |
| PostsRecent | Time-based filtering (different approach) |
| PostCreate | Creates posts returned by this function |
