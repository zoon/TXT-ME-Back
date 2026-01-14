# UsersSetActiveAvatar

Sets the user's active avatar. Avatar must exist in user's avatar list.

## Endpoint

| Property | Value |
|----------|-------|
| **Lambda** | `CMS-UsersSetActiveAvatar` |
| **Source** | `users/UsersSetActiveAvatar/index.js` |
| **Method** | `PUT` |
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
| `avatarId` | string | Yes | Avatar ID to set as active |

## Response

### 200 OK

```json
{
  "message": "Active avatar set",
  "avatarId": "timestamp-string"
}
```

### 400 Bad Request

```json
{ "error": "Missing avatarId" }
```

### 401 Unauthorized

```json
{ "error": "Missing token" }
```

### 404 Not Found

Avatar ID not in user's avatar list:
```json
{ "error": "Avatar not found" }
```

### 500 Internal Server Error

```json
{ "error": "error message details" }
```

Note: 500 response exposes raw error message (potential info leak).

## Logic

1. Extract and verify JWT from `Authorization` header
2. Get `avatarId` from path parameters
3. Fetch user from `CMS-Users`
4. Validate avatar exists in user's `avatars` array
5. Update user's `activeAvatarId` and `updatedAt`
6. Return success with avatarId

## Avatar Validation

```javascript
const avatars = userResult.Item?.avatars || [];
const avatarExists = avatars.some(a => a.avatarId === avatarId);
```

Checks if provided avatarId matches any avatar in user's collection.

## Data Model

**Table:** `CMS-Users`

| Attribute | Type | Updated |
|-----------|------|---------|
| `activeAvatarId` | String | Set to provided avatarId |
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
- Uses `userToken.userId` only (no `sub` fallback)
- `updatedAt` stored as ISO string, not Unix timestamp (inconsistent with other functions)
- Verbose logging: logs token length, user ID, headers
- 500 response exposes `error.message` directly
