# PostsGet

Fetches a single post by ID. Public endpoint.

## Endpoint

| Property | Value |
|----------|-------|
| **Lambda** | `CMS-PostsGet` |
| **Source** | `posts/PostsGet/index.mjs` |
| **Method** | `GET` |
| **Path** | `/{postId}` |
| **Auth** | None (public) |

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Post ID (UUID) |

## Response

### 200 OK

```json
{
  "post": {
    "postId": "uuid",
    "userId": "uuid",
    "username": "string",
    "title": "string",
    "content": "string",
    "tags": ["tagId"],
    "createdAt": 1234567890,
    "updatedAt": 1234567890,
    "commentCount": 0,
    "postAvatarId": "avatarId"
  }
}
```

### 400 Bad Request

```json
{ "error": "Post ID is required" }
```

### 404 Not Found

```json
{ "error": "Post not found" }
```

### 500 Internal Server Error

```json
{ "error": "Internal server error" }
```

## Logic

1. Extract `postId` from `event.pathParameters.id`
2. Validate postId is present
3. Fetch post from `CMS-Posts` table using `GetCommand`
4. Return post or 404 if not found

## Data Model

**Table:** `CMS-Posts`

| Attribute | Type | Description |
|-----------|------|-------------|
| `postId` | String (PK) | UUID v4 |
| `userId` | String | Author's user ID |
| `username` | String | Author's username |
| `title` | String | Post title |
| `content` | String | Post body |
| `tags` | List | Tag IDs |
| `createdAt` | Number | Unix timestamp (ms) |
| `updatedAt` | Number | Unix timestamp (ms) |
| `commentCount` | Number | Comment count |
| `postAvatarId` | String | Optional avatar reference |

## Dependencies

- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`

## Notes

- No CORS preflight handler - relies on API Gateway for OPTIONS
- Logs full event to CloudWatch (may include sensitive headers)
- Uses default AWS region from environment (no hardcoded region)
