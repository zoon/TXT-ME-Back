# CommentDelete

Deletes a comment and decrements the post's comment counter. Owner-only operation.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-CommentDelete` |
| **Handler** | `comments/CommentDelete/index.mjs` |
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
DELETE /posts/{id}/comments/{commentId}
DELETE /comments/{commentId}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Post ID (optional validation) |
| `commentId` | string | Yes | Comment ID to delete |

## Response

### 200 OK - Comment Deleted
```json
{
  "message": "Comment deleted successfully",
  "commentId": "uuid",
  "postId": "uuid"
}
```

### 400 Bad Request - Missing Comment ID
```json
{
  "error": "Comment ID is required"
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
  "error": "Forbidden: You can only delete your own comments"
}
```

### 404 Not Found - Comment Missing
```json
{
  "error": "Comment not found"
}
```

### 404 Not Found - Wrong Post
```json
{
  "error": "Comment does not belong to this post"
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
| CMS-Comments | GetCommand | Verify comment exists and ownership |
| CMS-Comments | DeleteCommand | Delete the comment |
| CMS-Posts | UpdateCommand | Decrement commentCount |

### Counter Decrement Expression
```javascript
UpdateExpression: "SET commentCount = if_not_exists(commentCount, :zero) - :one"
ExpressionAttributeValues: { ":one": 1, ":zero": 0 }
```

Safe decrement - handles missing `commentCount` field.

## Flow

```
1. Extract and validate Bearer token
2. Verify JWT, extract userId
3. Get commentId from path params → 400 if missing
4. Fetch comment from CMS-Comments → 404 if not found
5. If postId provided, verify comment.postId matches → 404 if mismatch
6. Check comment.userId === token.userId → 403 if not owner
7. Delete comment from CMS-Comments
8. Decrement commentCount on post (blocking)
9. Return success with commentId and postId
```

## Post ID Validation

The `postId` path parameter is **optional**:

```
DELETE /comments/abc-123           ✓ Works (no post validation)
DELETE /posts/xyz/comments/abc-123 ✓ Works (validates comment belongs to post)
```

When provided, validates comment belongs to specified post:
```javascript
if (postId && getResult.Item.postId !== postId) {
  return 404;  // "Comment does not belong to this post"
}
```

## Counter Decrement

### Expression Breakdown
```javascript
if_not_exists(commentCount, :zero) - :one
```

| Scenario | Result |
|----------|--------|
| `commentCount = 5` | `5 - 1 = 4` |
| `commentCount = 1` | `1 - 1 = 0` |
| `commentCount = 0` | `0 - 1 = -1` ⚠️ |
| `commentCount` missing | `0 - 1 = -1` ⚠️ |

**Issue:** Can go negative if counter is already 0 or missing.

### Comparison to CommentCreate

| Aspect | CommentCreate | CommentDelete |
|--------|---------------|---------------|
| Expression | `ADD commentCount :inc` | `SET ... - :one` |
| Fire-and-forget | Yes (try/catch ignored) | No (blocking) |
| Handles missing | Creates with value 1 | Sets to -1 |

## Nested Comments

**Orphan behavior:** Deleting a parent comment does NOT delete replies.

```
Before:
├── Comment A
│   └── Reply A1 (parentCommentId: A)
│   └── Reply A2 (parentCommentId: A)

After deleting Comment A:
├── Reply A1 (parentCommentId: A) ← orphaned
├── Reply A2 (parentCommentId: A) ← orphaned
```

Replies remain with `parentCommentId` pointing to deleted comment.

## Authorization

### Token Verification
```javascript
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};
```

### Ownership Check
```javascript
if (getResult.Item.userId !== userId) {
  return 403;  // Forbidden
}
```

Only comment creator can delete - no admin override.

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
curl -X DELETE "https://api.example.com/posts/post-123/comments/comment-456" \
  -H "Authorization: Bearer eyJhbGc..."
```

### Response
```json
{
  "message": "Comment deleted successfully",
  "commentId": "comment-456",
  "postId": "post-123"
}
```

## Edge Cases

| Case | Behavior |
|------|----------|
| Delete own comment | Success |
| Delete other's comment | 403 Forbidden |
| Delete with wrong postId | 404 "Comment does not belong to this post" |
| Delete without postId | Success (no post validation) |
| Delete already deleted | 404 "Comment not found" |
| Delete nested comment | Success, replies orphaned |
| Post counter at 0 | Goes to -1 (no floor check) |

## Related Functions

| Function | Relationship |
|----------|--------------|
| CommentCreate | Creates comments (increments counter) |
| CommentsList | Lists comments (may show orphans) |
| PostDelete | Cascade deletes all comments |
| PostsGet | Returns post with commentCount |
