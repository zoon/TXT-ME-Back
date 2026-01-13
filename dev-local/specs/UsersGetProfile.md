# UsersGetProfile

Returns the authenticated user's profile. Excludes password hash.

## Endpoint

| Property | Value |
|----------|-------|
| **Lambda** | `CMS-UsersGetProfile` |
| **Source** | `users/UsersGetProfile/index.mjs` |
| **Method** | `GET` |
| **Auth** | Bearer JWT |

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <JWT token>` |

## Response

### 200 OK

```json
{
  "userId": "uuid",
  "username": "string",
  "email": "user@example.com",
  "role": "user",
  "status": "active",
  "avatars": [
    {
      "avatarId": "timestamp-string",
      "dataUrl": "data:image/...",
      "uploadedAt": "timestamp-string"
    }
  ],
  "activeAvatarId": "timestamp-string",
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

All user fields except `passwordHash` are returned.

### 401 Unauthorized

Missing or malformed Authorization header:
```json
{ "error": "Missing or invalid authorization token" }
```

Invalid/expired JWT:
```json
{ "error": "Invalid or expired token" }
```

### 404 Not Found

User ID from JWT doesn't exist in database:
```json
{ "error": "User not found" }
```

### 500 Internal Server Error

```json
{ "error": "Internal server error" }
```

## Logic

1. Extract `Authorization` header (case-insensitive)
2. Validate `Bearer ` prefix
3. Verify JWT using `verifyToken()` helper
4. Fetch user from `CMS-Users` by `userId` from JWT
5. Destructure to exclude `passwordHash`
6. Return remaining profile fields

## JWT Extraction

```javascript
// Uses userId directly from JWT payload
const user = verifyToken(token);
// Fetches by user.userId (not user.sub)
```

Note: Uses `user.userId` only, unlike other functions that check both `decoded.sub` and `decoded.userId`.

## Data Model

**Table:** `CMS-Users`

| Attribute | Type | Returned |
|-----------|------|----------|
| `userId` | String (PK) | Yes |
| `username` | String | Yes |
| `passwordHash` | String | **No** (excluded) |
| `email` | String | Yes (if set) |
| `role` | String | Yes |
| `status` | String | Yes |
| `avatars` | List | Yes |
| `activeAvatarId` | String | Yes |
| `createdAt` | Number | Yes |
| `updatedAt` | Number | Yes |

## Dependencies

- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`
- `jsonwebtoken`

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `cms-jwt-secret-prod-2025` | JWT signing secret |

## Notes

- No CORS preflight handler (no OPTIONS check)
- Logs full event to CloudWatch
- Helper `verifyToken()` returns `null` on any JWT error (silent fail)
- 404 possible if user deleted after JWT issued
