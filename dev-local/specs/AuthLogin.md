# AuthLogin

Authenticates a user and returns a JWT token.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-AuthLogin` |
| **Handler** | `auth/AuthLogin/index.mjs` |
| **Runtime** | Node.js (ES Modules) |
| **HTTP Method** | POST |
| **Authentication** | None (public endpoint) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-dynamodb` | DynamoDB client |
| `@aws-sdk/lib-dynamodb` | Document client wrapper |
| `bcryptjs` | Password hash verification |
| `jsonwebtoken` | JWT generation |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | `cms-jwt-secret-change-in-production` | Secret for signing JWT tokens |
| `AWS_REGION` | Yes | (from Lambda) | AWS region for DynamoDB |

## Request

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "username": "string",
  "password": "string"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `username` | string | Yes | Must match existing user |
| `password` | string | Yes | Verified against bcrypt hash |

## Response

### 200 OK - Login Successful
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "uuid-v4",
    "username": "string",
    "role": "admin|user"
  }
}
```

### 400 Bad Request - Missing Fields
```json
{
  "error": "Username and password are required"
}
```

### 401 Unauthorized - Invalid Credentials
```json
{
  "error": "Invalid credentials"
}
```
Returned when username not found OR password incorrect (same message for security).

### 403 Forbidden - Account Not Activated
```json
{
  "error": "User account not activated. Contact administrator."
}
```
Returned when user exists but has no `role` assigned (pending admin approval).

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## JWT Token

### Payload
```json
{
  "userId": "uuid-v4",
  "username": "string",
  "role": "admin|user",
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Properties
- **Algorithm**: HS256
- **Expiration**: 1 hour from issuance
- **Usage**: Pass as `Authorization: Bearer <token>` header

## Database Access

### Table: CMS-Users

**Query via GSI:**
```
IndexName: username-index
KeyConditionExpression: username = :username
```

**Fields Read:**
- `userId` - returned in response and JWT
- `username` - returned in response and JWT
- `role` - checked for activation, returned in response and JWT
- `passwordHash` - compared with bcrypt

## Flow

```
1. Parse request body
2. Validate username and password present
3. Query CMS-Users by username (GSI)
4. If no user found → 401
5. If user.role is empty → 403 (not activated)
6. Compare password with bcrypt hash
7. If password invalid → 401
8. Generate JWT with userId, username, role
9. Return token and user info
```

## Security Notes

- Password comparison uses constant-time bcrypt
- Same error message for "user not found" and "wrong password" prevents enumeration
- Inactive accounts (no role) explicitly rejected with different error
- JWT secret has insecure default - must set `JWT_SECRET` in production

## CORS Headers

```json
{
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-user-id,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
}
```

## Example

### Request
```bash
curl -X POST https://api.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "secret123"}'
```

### Response
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0IiwidXNlcm5hbWUiOiJqb2huIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MDUxNTAwMDAsImV4cCI6MTcwNTE1MzYwMH0.xxx",
  "user": {
    "userId": "1234",
    "username": "john",
    "role": "user"
  }
}
```
