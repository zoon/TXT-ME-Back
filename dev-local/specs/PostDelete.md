# PostDelete

Deletes a post and all associated comments. Owner-only operation with cascade delete.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-PostDelete` |
| **Handler** | `posts/PostDelete/index.mjs` |
| **Runtime** | Node.js (ES Modules) |
| **HTTP Method** | DELETE |
| **Authentication** | Bearer JWT |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-dynamodb` | DynamoDB client |
| `@aws-sdk/lib-dynamodb` | Document client wrapper |
| `jsonwebtoken` | JWT verification |

## Configuration

| Setting | Value | Note |
|---------|-------|------|
| Region | Default (from env) | Not hardcoded |
| JWT Secret | `JWT_SECRET` env or `cms-jwt-secret-prod-2025` | Fallback |

## Request

### Headers
```
Authorization: Bearer <jwt-token>
```

### Path Parameters
```
DELETE /posts/{id}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Post ID to delete |

## Response

### 200 OK - Post Deleted
```json
{
  "message": "Post and associated comments deleted successfully",
  "postId": "uuid",
  "deletedComments": 5
}
```

### 400 Bad Request - Missing Post ID
```json
{
  "error": "Post ID is required"
}
```

### 401 Unauthorized - Missing Token
```json
{
  "error": "Missing or invalid authorization token"
}
```

### 401 Unauthorized - Invalid Token
```json
{
  "error": "Invalid or expired token"
}
```

### 403 Forbidden - Not Owner
```json
{
  "error": "Forbidden: You can only delete your own posts"
}
```

### 404 Not Found
```json
{
  "error": "Post not found"
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

### Tables & Operations

| Table | Operation | Purpose |
|-------|-----------|---------|
| CMS-Posts | GetCommand | Verify post exists and ownership |
| CMS-Comments | QueryCommand (GSI) | Find all comments for post |
| CMS-Comments | BatchWriteCommand | Delete comments in batches |
| CMS-Posts | DeleteCommand | Delete the post |

### GSI Used
```
IndexName: postId-index
KeyConditionExpression: postId = :postId
```

## Flow

```
1. Extract and validate Bearer token
2. Verify JWT, extract userId
3. Get postId from path parameters → 400 if missing
4. Fetch post from CMS-Posts → 404 if not found
5. Check post.userId === token.userId → 403 if not owner
6. Query all comments via postId-index GSI
7. Batch delete comments (25 per batch)
8. Delete the post
9. Return success with deleted comment count
```

## Cascade Delete Logic

### Batch Processing
```javascript
const batchSize = 25;  // DynamoDB BatchWrite limit
for (let i = 0; i < comments.length; i += batchSize) {
  const batch = comments.slice(i, i + batchSize);
  // BatchWriteCommand for batch
}
```

### Delete Order
1. Comments deleted **first** (preserves referential integrity)
2. Post deleted **last**

### Failure Scenarios

| Scenario | Result |
|----------|--------|
| Comment batch fails mid-way | Partial deletion, orphaned comments |
| Post delete fails after comments | Orphaned comments, post still exists |
| No transaction wrapping | Not atomic |

## Batch Write Details

```javascript
{
  RequestItems: {
    "CMS-Comments": [
      { DeleteRequest: { Key: { commentId: "..." } } },
      { DeleteRequest: { Key: { commentId: "..." } } },
      // ... up to 25 items
    ]
  }
}
```

**Note:** BatchWriteCommand doesn't handle unprocessed items - they're silently dropped.

## Authorization

### Token Verification
```javascript
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;  // Any error returns null
  }
};
```

### Ownership Check
```javascript
if (getResult.Item.userId !== userId) {
  return 403;  // Forbidden
}
```

Only the post creator can delete - no admin override.

## Performance Considerations

| Concern | Impact | Notes |
|---------|--------|-------|
| GSI query | Efficient | Uses postId-index |
| Batch delete | 25 items/request | Multiple round trips for large comment counts |
| No pagination | Memory risk | All comments loaded at once |
| Sequential batches | Latency | Could parallelize batch deletes |

### Scaling Limits

| Comments | Batches | Approximate Time |
|----------|---------|------------------|
| 25 | 1 | ~100ms |
| 100 | 4 | ~400ms |
| 1000 | 40 | ~4s |

## CORS Headers

```json
{
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
}
```

## Example

### Request
```bash
curl -X DELETE "https://api.example.com/posts/abc-123" \
  -H "Authorization: Bearer eyJhbGc..."
```

### Response
```json
{
  "message": "Post and associated comments deleted successfully",
  "postId": "abc-123",
  "deletedComments": 12
}
```

## Edge Cases

| Case | Behavior |
|------|----------|
| Post with 0 comments | Skips batch delete, deletes post |
| Post with 1000+ comments | Multiple batch rounds, no pagination limit |
| Concurrent delete requests | Race condition possible |
| Token expired mid-operation | Operation continues (already validated) |

## Related Functions

| Function | Relationship |
|----------|--------------|
| PostCreate | Creates posts (with commentCount: 0) |
| PostUpdate | Updates post (owner-only, similar auth) |
| CommentCreate | Creates comments (increments count) |
| CommentDelete | Deletes single comment (decrements count) |
