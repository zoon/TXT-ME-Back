# CommentsList

Lists comments for a post with cursor pagination. Oldest first.

## Endpoint

| Property | Value |
|----------|-------|
| **Lambda** | `CMS-CommentsList` |
| **Source** | `comments/CommentsList/index.mjs` |
| **Method** | `GET` |
| **Path** | `/posts/{postId}/comments` |
| **Auth** | None (public) |

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Post ID (UUID) |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | string | `"50"` | Max comments to return (capped at 100) |
| `lastKey` | string | - | URL-encoded JSON cursor for pagination |

## Response

### 200 OK

```json
{
  "comments": [
    {
      "commentId": "uuid",
      "postId": "uuid",
      "userId": "uuid",
      "username": "string",
      "content": "string",
      "createdAt": 1234567890,
      "parentCommentId": "uuid",
      "commentAvatarId": "avatarId"
    }
  ],
  "count": 50,
  "nextKey": "encoded-cursor-string"
}
```

| Field | Description |
|-------|-------------|
| `comments` | Array of comment objects |
| `count` | Number of comments in this response |
| `nextKey` | Cursor for next page; `null` if no more results |

### 400 Bad Request

```json
{ "error": "Post ID is required" }
```

### 500 Internal Server Error

```json
{ "error": "Internal server error" }
```

## Logic

1. Extract `postId` from `event.pathParameters.id`
2. Parse query params: `limit` (default 50, max 100), `lastKey`
3. Query `CMS-Comments` using `postId-index` GSI
4. Sort ascending by `createdAt` (`ScanIndexForward: true`)
5. If `lastKey` provided, decode and use as `ExclusiveStartKey`
6. Return comments with count and next cursor

## Pagination

Cursor-based using DynamoDB's `LastEvaluatedKey`:

```javascript
// Encode for response
nextKey = encodeURIComponent(JSON.stringify(result.LastEvaluatedKey));

// Decode from request
ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));
```

Invalid `lastKey` is silently ignored (logs error, continues without pagination).

## Data Model

**Table:** `CMS-Comments`
**Index:** `postId-index` (GSI)

| Attribute | Type | Description |
|-----------|------|-------------|
| `commentId` | String (PK) | UUID v4 |
| `postId` | String | Parent post ID |
| `userId` | String | Author's user ID |
| `username` | String | Author's username |
| `content` | String | Comment body |
| `createdAt` | Number | Unix timestamp (ms) |
| `parentCommentId` | String | Optional parent for nesting |
| `commentAvatarId` | String | Optional avatar reference |

## Dependencies

- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`

## Notes

- Does not verify post exists - returns empty array for non-existent posts
- Logs full event to CloudWatch
- Uses default AWS region from environment
- `ScanIndexForward: true` works correctly here (unlike Scan in PostsList)
