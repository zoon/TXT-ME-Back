# PostCreate

Creates a new post with optional tags and avatar. Initializes comment counter.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-PostCreate` |
| **Handler** | `posts/PostCreate/index.mjs` |
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
| JWT Secret | `JWT_SECRET` env or `cms-jwt-secret-prod-2025` | Fallback |

## Request

### Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Body
```json
{
  "title": "string",
  "content": "string",
  "tags": ["tagId1", "tagId2"],
  "postAvatarId": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Post title |
| `content` | string | Yes | Post body content |
| `tags` | string[] | No | Array of tag IDs (defaults to `[]`) |
| `postAvatarId` | string | No | Avatar override (falls back to user's active) |

## Response

### 200 OK - Preflight (OPTIONS)
Empty body with CORS headers.

### 201 Created - Post Created
```json
{
  "message": "Post created successfully",
  "post": {
    "postId": "uuid-v4",
    "userId": "uuid",
    "username": "string",
    "title": "string",
    "content": "string",
    "tags": ["tagId1"],
    "createdAt": 1704456000000,
    "updatedAt": 1704456000000,
    "commentCount": 0,
    "postAvatarId": "string (if set)"
  }
}
```

### 400 Bad Request - Missing Fields
```json
{
  "error": "Title and content are required"
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
| CMS-Posts | PutCommand | Store new post |

### Post Document
```json
{
  "postId": "uuid-v4",
  "userId": "string",
  "username": "string",
  "title": "string",
  "content": "string",
  "tags": ["tagId1", "tagId2"],
  "createdAt": 1704456000000,
  "updatedAt": 1704456000000,
  "commentCount": 0,
  "postAvatarId": "string (optional)"
}
```

## Flow

```
1. Handle OPTIONS preflight → 200
2. Extract JWT from Authorization header
3. Verify JWT, extract userId and username
   - Supports both `decoded.sub` and `decoded.userId`
4. Parse body, validate title and content → 400 if missing
5. Resolve avatar:
   a. Use provided postAvatarId if present
   b. Otherwise fetch user's activeAvatarId from CMS-Users
   c. Silently skip if fetch fails
6. Generate UUID v4 for postId
7. Build post object with:
   - postId, userId, username, title, content
   - tags (default [])
   - createdAt, updatedAt (same timestamp)
   - commentCount: 0
   - postAvatarId (if resolved)
8. Put post to CMS-Posts
9. Return 201 with full post object
```

## Avatar Resolution

```
1. If postAvatarId provided → use it
2. Else fetch user from CMS-Users
3. If user has activeAvatarId → use it
4. Else → no avatar on post
```

Avatar fetch failure is **non-blocking** - post still created.

## JWT Claims

Supports two claim formats:

| Claim | Priority | Source |
|-------|----------|--------|
| `sub` | 1st | Standard JWT claim |
| `userId` | 2nd | Custom claim (AuthLogin uses this) |
| `username` | Required | Stored in post |

## Tags Handling

```javascript
tags: tags || []
```

| Input | Result |
|-------|--------|
| `["a", "b"]` | `["a", "b"]` |
| `[]` | `[]` |
| `undefined` | `[]` |
| `null` | `[]` |

**Note:** No validation that tag IDs exist in CMS-Tags table.

## Timestamps

```javascript
const now = Date.now();
post.createdAt = now;
post.updatedAt = now;
```

- Both set to same value on creation
- `updatedAt` modified by PostUpdate
- Stored as milliseconds (number)

## Comment Counter

```javascript
commentCount: 0
```

Initialized to 0. Modified by:
- CommentCreate: increments
- CommentDelete: decrements
- PostDelete: not updated (post deleted)

## Error Handling

| Error Type | Response |
|------------|----------|
| Missing token | 401 "No token provided" |
| JsonWebTokenError | 401 "Invalid token" |
| TokenExpiredError | 401 "Invalid token" |
| Missing title/content | 400 "Title and content are required" |
| DB errors | 500 with details |
| Avatar fetch fail | Logged, continues |

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
curl -X POST https://api.example.com/posts \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Post",
    "content": "Hello world!",
    "tags": ["tech-123", "news-456"]
  }'
```

### Response
```json
{
  "message": "Post created successfully",
  "post": {
    "postId": "abc-def-123",
    "userId": "user-789",
    "username": "johndoe",
    "title": "My First Post",
    "content": "Hello world!",
    "tags": ["tech-123", "news-456"],
    "createdAt": 1704456000000,
    "updatedAt": 1704456000000,
    "commentCount": 0,
    "postAvatarId": "1704400000000"
  }
}
```

## Validation Gaps

| Field | Missing Validation |
|-------|-------------------|
| title | No length limits |
| content | No length limits |
| tags | No existence check |
| tags | No array length limit |

## Related Functions

| Function | Relationship |
|----------|--------------|
| PostUpdate | Modifies post (owner-only) |
| PostDelete | Deletes post and comments |
| PostsGet | Retrieves single post |
| PostsList | Lists all posts |
| CommentCreate | Increments commentCount |
