# UsersGetUserAvatar

Fetches a user's avatars and active avatar data. Public endpoint.

## Endpoint

| Property | Value |
|----------|-------|
| **Lambda** | `CMS-UsersGetUserAvatar` |
| **Source** | `users/UsersGetUserAvatar/index.js` |
| **Method** | `GET` |
| **Path** | `/{userId}` |
| **Auth** | None (public) |

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | User ID (UUID) |

## Response

### 200 OK

```json
{
  "userId": "uuid",
  "username": "string",
  "avatars": [
    {
      "avatarId": "timestamp-string",
      "dataUrl": "data:image/...",
      "uploadedAt": "timestamp-string"
    }
  ],
  "activeAvatarId": "timestamp-string",
  "avatarDataUrl": "data:image/..."
}
```

| Field | Description |
|-------|-------------|
| `userId` | User's ID |
| `username` | User's display name |
| `avatars` | Full array of user's avatars |
| `activeAvatarId` | Currently active avatar ID (or `null`) |
| `avatarDataUrl` | Active avatar's data URL (or `null`) |

### 404 Not Found

```json
{ "error": "User not found" }
```

### 500 Internal Server Error

```json
{ "error": "Internal server error", "details": "..." }
```

## Logic

1. Extract `userId` from path parameters
2. Fetch user from `CMS-Users`
3. Return 404 if user not found
4. Find active avatar in avatars array
5. Return user info with avatars and active avatar data

## Active Avatar Resolution

```javascript
const activeAvatar = avatars.find(a => a.avatarId === user.activeAvatarId);
// Returns dataUrl of active avatar, or null if not found
avatarDataUrl: activeAvatar?.dataUrl || null
```

## Data Model

**Table:** `CMS-Users`

| Attribute | Type | Returned |
|-----------|------|----------|
| `userId` | String (PK) | Yes |
| `username` | String | Yes |
| `avatars` | List | Yes (full array) |
| `activeAvatarId` | String | Yes |
| `passwordHash` | String | No (not selected) |
| `email` | String | No (not selected) |
| `role` | String | No (not selected) |
| `status` | String | No (not selected) |

## Dependencies

- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`

## Notes

- **CommonJS module** (`.js`, uses `require`/`exports`)
- No authentication required - public endpoint
- No CORS preflight handler
- Exposes all avatars (including dataUrls) publicly
- Minimal CORS headers (no `Access-Control-Allow-Headers/Methods`)
- 500 response exposes `error.message` (potential info leak)
- Logs username and avatar count to CloudWatch
