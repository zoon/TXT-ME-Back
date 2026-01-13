# UsersDeleteAvatar

Deletes an avatar from user's collection. Cannot delete the active avatar.

## Endpoint

| Property | Value |
|----------|-------|
| **Lambda** | `CMS-UsersDeleteAvatar` |
| **Source** | `users/UsersDeleteAvatar/index.js` |
| **Method** | `DELETE` |
| **Path** | `/{avatarId}` |
| **Auth** | Bearer JWT |

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <JWT token>` |

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `avatarId` | string | Yes | Avatar ID to delete |

## Response

### 200 OK

```json
{
  "message": "Avatar deleted",
  "avatarId": "timestamp-string"
}
```

### 400 Bad Request

Cannot delete active avatar:
```json
{ "error": "Cannot delete active avatar" }
```

### 500 Internal Server Error

```json
{ "error": "Internal error" }
```

## Logic

1. Handle CORS preflight (`OPTIONS` returns 200)
2. Extract and verify JWT from `Authorization` header
3. Get `avatarId` from path parameters
4. Fetch user from `CMS-Users`
5. Check if avatar is active - reject if so
6. Filter out avatar from `avatars` array
7. Update user with new avatars array and `updatedAt`
8. Return success

## Avatar Deletion

```javascript
const avatars = (userItem.avatars || []).filter(a => a.avatarId !== avatarId);
```

Filters array client-side, then writes entire array back. No validation that avatar existed before deletion.

## Data Model

**Table:** `CMS-Users`

| Attribute | Type | Updated |
|-----------|------|---------|
| `avatars` | List | Filtered array without deleted avatar |
| `updatedAt` | String | ISO timestamp |

## Dependencies

- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`
- `jsonwebtoken`

## Environment

| Variable | Hardcoded | Description |
|----------|-----------|-------------|
| `JWT_SECRET` | `cms-jwt-secret-prod-2025` | JWT signing secret |

## Notes

- **CommonJS module** (`.js`, uses `require`/`exports`)
- Has CORS preflight handler (unlike UsersSetActiveAvatar)
- No 404 for non-existent avatar - silently succeeds
- No 401 response defined - JWT errors fall through to 500
- `updatedAt` stored as ISO string (inconsistent with some functions)
- Uses `user.userId` only (no `sub` fallback)
- Token extraction: `substring(7)` assumes "Bearer " prefix without validation
