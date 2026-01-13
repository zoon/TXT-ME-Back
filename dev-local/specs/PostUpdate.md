# PostUpdate

Updates an existing post. Owner-only operation.

## Endpoint

| Property | Value |
|----------|-------|
| **Lambda** | `CMS-PostUpdate` |
| **Source** | `posts/PostUpdate/index.mjs` |
| **Method** | `PUT` |
| **Path** | `/{postId}` |
| **Auth** | Bearer JWT |

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <JWT token>` |
| `Content-Type` | Yes | `application/json` |

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Post ID (UUID) |

### Body

All fields optional. Only provided fields are updated.

```json
{
  "title": "string",
  "content": "string",
  "tags": ["tagId1", "tagId2"],
  "postAvatarId": "avatarId"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | New post title |
| `content` | string | No | New post body |
| `tags` | string[] | No | Replace tag array |
| `postAvatarId` | string \| null | No | Set avatar; `null` or `""` removes it |

## Response

### 200 OK

```json
{ "message": "Post updated successfully" }
```

### 401 Unauthorized

```json
{ "error": "Unauthorized: No token provided" }
```

```json
{ "error": "Unauthorized: Invalid token" }
```

### 403 Forbidden

```json
{ "error": "Forbidden: You can only edit your own posts" }
```

### 404 Not Found

```json
{ "error": "Post not found" }
```

### 500 Internal Server Error

```json
{ "error": "Internal server error", "details": "..." }
```

## Logic

1. Handle CORS preflight (`OPTIONS` returns 200)
2. Extract and verify JWT from `Authorization` header
3. Get `postId` from path parameters (`event.pathParameters.id`)
4. Fetch existing post from `CMS-Posts`
5. Verify caller is the post owner (`post.userId === jwt.userId`)
6. Build dynamic `UpdateExpression`:
   - `SET` clause for title, content, tags, postAvatarId, updatedAt
   - `REMOVE` clause if postAvatarId is null/empty
7. Execute update
8. Return success message

## Update Expression Building

```
SET title = :title, content = :content, tags = :tags, updatedAt = :updatedAt
```

Special handling for `postAvatarId`:
- If provided with value → `SET postAvatarId = :avatarId`
- If `null` or `""` → `REMOVE postAvatarId`
- If not provided → no change

## Data Model

**Table:** `CMS-Posts`

| Attribute | Type | Updated |
|-----------|------|---------|
| `postId` | String (PK) | Never |
| `title` | String | If provided |
| `content` | String | If provided |
| `tags` | List | If provided |
| `postAvatarId` | String | If provided (or removed) |
| `updatedAt` | Number | Always (timestamp ms) |

## Dependencies

- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`
- `jsonwebtoken`

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `cms-jwt-secret-prod-2025` | JWT signing secret |

## Notes

- No validation that new tag IDs exist in `CMS-Tags`
- `USERS_TABLE` constant defined but unused (dead code)
- `updatedAt` always set regardless of whether other fields changed
