# UsersUpdateEmail

Updates the authenticated user's email address.

## Endpoint

| Property | Value |
|----------|-------|
| **Lambda** | `CMS-UsersUpdateEmail` |
| **Source** | `users/UsersUpdateEmail/index.js` |
| **Method** | `PUT` |
| **Auth** | Bearer JWT |

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <JWT token>` |
| `Content-Type` | Yes | `application/json` |

### Body

```json
{
  "email": "user@example.com"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | Yes | Must contain `@` |

## Response

### 200 OK

```json
{
  "message": "Email updated",
  "email": "user@example.com"
}
```

### 400 Bad Request

Missing or invalid email:
```json
{ "error": "Invalid email" }
```

### 401 Unauthorized

```json
{ "error": "Missing token" }
```

### 500 Internal Server Error

```json
{ "error": "Internal error" }
```

## Logic

1. Extract and validate `Authorization` header (must start with `Bearer `)
2. Verify JWT token
3. Parse request body and extract `email`
4. Validate email contains `@`
5. Update user's `email` and `updatedAt` in DynamoDB
6. Return success with new email

## Email Validation

```javascript
if (!email || !email.includes('@')) {
  return { statusCode: 400, ... };
}
```

Minimal validation - only checks for `@` character presence.

## Data Model

**Table:** `CMS-Users`

| Attribute | Type | Updated |
|-----------|------|---------|
| `email` | String | Set to provided email |
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
- No CORS preflight handler
- No email uniqueness check - multiple users can have same email
- No email verification/confirmation flow
- `updatedAt` stored as ISO string (inconsistent with some functions)
- Uses `user.userId` only (no `sub` fallback)
- JWT errors fall through to generic 500
