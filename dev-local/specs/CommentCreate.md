# CommentCreate

Creates a comment on a post. Supports nested comments and auto-increments post's comment counter.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-CommentCreate` |
| **Handler** | `comments/CommentCreate/index.mjs` |
| **Runtime** | Node.js (ES Modules) |
| **HTTP Method** | POST |
| **Authentication** | Bearer JWT |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-dynamodb` | DynamoDB client |
| `@aws-sdk/lib-dynamodb` | Document client wrapper |
| `uuid` | UUID v4 generation |
| `jsonwebtoken` | JWT verification |

## Configuration

| Setting | Value | Note |
|---------|-------|------|
| Region | `eu-north-1` | Hardcoded |
| JWT Secret | `JWT_SECRET` env or `cms-jwt-secret-prod-2025` | Fallback matches UsersAddAvatar |

## Request

### Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Path Parameters
```
POST /posts/{id}/comments
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Post ID to comment on |

### Body
```json
{
  "content": "string",
  "parentCommentId": "uuid (optional)",
  "commentAvatarId": "string (optional)"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Comment text |
| `parentCommentId` | string | No | Parent comment ID for nested replies |
| `commentAvatarId` | string | No | Override avatar (falls back to user's active) |

## Response

### 200 OK - Preflight (OPTIONS)
Empty body with CORS headers.

### 201 Created - Comment Added
```json
{
  "message": "Comment created successfully",
  "comment": {
    "commentId": "uuid-v4",
    "postId": "uuid",
    "userId": "uuid",
    "username": "string",
    "content": "string",
    "createdAt": 1704456000000,
    "parentCommentId": "uuid (if nested)",
    "commentAvatarId": "string (if set)"
  }
}
```

### 400 Bad Request - Missing Content
```json
{
  "error": "Content is required"
}
```

### 401 Unauthorized - No Token
```json
{
  "error": "Unauthorized: No token provided"
}
```

### 401 Unauthorized - Invalid Token
```json
{
  "error": "Unauthorized: Invalid token"
}
```
Handles both `JsonWebTokenError` and `TokenExpiredError`.

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "error message"
}
```

## Database Access

### Tables Used

| Table | Operation | Purpose |
|-------|-----------|---------|
| CMS-Users | GetCommand | Fetch user's activeAvatarId |
| CMS-Comments | PutCommand | Store new comment |
| CMS-Posts | UpdateCommand | Increment commentCount |

### Comment Document
```json
{
  "commentId": "uuid-v4",
  "postId": "string",
  "userId": "string",
  "username": "string",
  "content": "string",
  "createdAt": 1704456000000,
  "parentCommentId": "string (optional)",
  "commentAvatarId": "string (optional)"
}
```

### Post Counter Update
```
UpdateExpression: ADD commentCount :inc
ExpressionAttributeValues: { ":inc": 1 }
```
Atomic increment - safe for concurrent writes.

## Flow

```
1. Handle OPTIONS preflight → 200
2. Extract JWT from Authorization header
3. Verify JWT, extract userId and username
   - Supports both `decoded.sub` and `decoded.userId`
4. Get postId from path parameters
5. Parse body, validate content exists
6. Resolve avatar:
   a. Use provided commentAvatarId if present
   b. Otherwise fetch user's activeAvatarId from CMS-Users
   c. Silently skip if fetch fails
7. Generate UUID v4 for commentId
8. Build comment object (conditionally add parentCommentId, commentAvatarId)
9. Put comment to CMS-Comments
10. Increment commentCount on post (fire-and-forget, errors logged)
11. Return 201 with comment
```

## Nested Comments

Comments support one level of nesting via `parentCommentId`:

```
Post
├── Comment A (parentCommentId: null)
│   ├── Reply A1 (parentCommentId: A)
│   └── Reply A2 (parentCommentId: A)
└── Comment B (parentCommentId: null)
```

**Notes:**
- No validation that parentCommentId exists
- No validation that parent belongs to same post
- No depth limit enforced (client can nest arbitrarily)

## Avatar Resolution

```
1. If commentAvatarId provided → use it
2. Else fetch user from CMS-Users
3. If user has activeAvatarId → use it
4. Else → no avatar on comment
```

Avatar fetch failure is **non-blocking** - comment still created.

## JWT Claims

Supports two claim formats:

| Claim | Priority | Source |
|-------|----------|--------|
| `sub` | 1st | Standard JWT claim |
| `userId` | 2nd | Custom claim (AuthLogin uses this) |
| `username` | Required | Used in comment |

## Error Handling

| Error Type | Response |
|------------|----------|
| Missing token | 401 "No token provided" |
| JsonWebTokenError | 401 "Invalid token" |
| TokenExpiredError | 401 "Invalid token" |
| Missing content | 400 "Content is required" |
| DB errors | 500 with details |
| Avatar fetch fail | Logged, continues |
| Counter update fail | Logged, continues |

## CORS Headers

```json
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
}
```

## Example

### Request
```bash
curl -X POST https://api.example.com/posts/abc-123/comments \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"content": "Great post!", "parentCommentId": null}'
```

### Response
```json
{
  "message": "Comment created successfully",
  "comment": {
    "commentId": "def-456",
    "postId": "abc-123",
    "userId": "user-789",
    "username": "alice",
    "content": "Great post!",
    "createdAt": 1704456000000,
    "commentAvatarId": "1704400000000"
  }
}
```

## Related Functions

| Function | Relationship |
|----------|--------------|
| CommentDelete | Removes comment, decrements counter |
| CommentsList | Lists comments for a post |
| PostsGet | Returns post with commentCount |
| PostCreate | Creates post with commentCount: 0 |
