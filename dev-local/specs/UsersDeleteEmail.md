# UsersDeleteEmail

Removes the email address from the authenticated user's profile.

## Endpoint

| Property | Value |
|----------|-------|
| **Lambda** | `CMS-UsersDeleteEmail` |
| **Source** | `users/UsersDeleteEmail/index.js` |
| **Method** | `DELETE` |
| **Auth** | Bearer JWT |

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <JWT token>` |

No request body required.

## Response

### 200 OK

```json
{ "message": "Email removed successfully" }
```

### 401 Unauthorized

Missing token:
```json
{ "error": "No token provided" }
```

Invalid or expired token:
```json
{ "error": "Invalid or expired token" }
```

### 500 Internal Server Error

```json
{ "error": "Internal server error" }
```

## Logic

1. Extract token from `Authorization` header (strips `Bearer ` prefix)
2. Return 401 if no token
3. Verify JWT token
4. Remove `email` attribute and update `updatedAt`
5. Return success message

## DynamoDB Update

```javascript
UpdateExpression: 'REMOVE email SET updatedAt = :now'
```

Uses `REMOVE` to delete the email attribute entirely (not set to null).

## Data Model

**Table:** `CMS-Users`

| Attribute | Type | Updated |
|-----------|------|---------|
| `email` | String | Removed |
| `updatedAt` | String | ISO timestamp |

## Dependencies

- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`
- `jsonwebtoken`

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `cms-jwt-secret-prod-2025` | JWT signing secret |

## Notes

- **CommonJS module** (`.js`, uses `require`/`exports`)
- No CORS preflight handler
- Minimal CORS headers (no `Access-Control-Allow-Headers/Methods`)
- Properly catches JWT errors with specific 401 response (unlike most other user functions)
- Uses `decoded.userId` only (no `sub` fallback)
- Idempotent - succeeds even if email already absent
- `updatedAt` stored as ISO string
