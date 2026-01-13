# AuthRegister

Registers a new user account. Creates inactive user requiring admin approval.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-AuthRegister` |
| **Handler** | `auth/AuthRegister/index.mjs` |
| **Runtime** | Node.js (ES Modules) |
| **HTTP Method** | POST |
| **Authentication** | None (public endpoint) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-dynamodb` | DynamoDB client |
| `@aws-sdk/lib-dynamodb` | Document client wrapper |
| `bcryptjs` | Password hashing |
| `crypto` | UUID generation (built-in) |

## Configuration

| Setting | Value | Note |
|---------|-------|------|
| Region | `AWS_REGION` env | From environment |
| Bcrypt rounds | 10 | ~100ms hash time |

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
| `username` | string | Yes | Must be unique |
| `password` | string | Yes | No validation (any length) |

## Response

### 201 Created - Registration Successful
```json
{
  "message": "User registered successfully. Awaiting activation by admin.",
  "userId": "uuid-v4"
}
```

### 400 Bad Request - Missing Fields
```json
{
  "error": "Username and password are required"
}
```

### 409 Conflict - Username Exists
```json
{
  "error": "Username already exists"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Database Access

### Table: CMS-Users

**Uniqueness Check (Query):**
```
IndexName: username-index
KeyConditionExpression: username = :username
```

**User Creation (Put):**
```javascript
{
  userId: "uuid-v4",
  username: "string",
  passwordHash: "bcrypt-hash",
  createdAt: 1704456000000
}
```

### User Document (created)
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "johndoe",
  "passwordHash": "$2a$10$N9qo8uLOickgx2ZMRZoMy...",
  "createdAt": 1704456000000
}
```

**Note:** No `role` or `status` field - user is inactive until admin sets them.

## Flow

```
1. Parse request body
2. Validate username and password present → 400 if missing
3. Query username-index GSI for existing user
4. If username exists → 409 Conflict
5. Hash password with bcrypt (10 rounds)
6. Generate UUID v4 for userId
7. Create user document (no role = inactive)
8. Put to CMS-Users table
9. Return 201 with userId
```

## Password Hashing

### Algorithm
```javascript
const passwordHash = await bcrypt.hash(password, 10);
```

| Property | Value |
|----------|-------|
| Algorithm | bcrypt |
| Salt rounds | 10 |
| Output format | `$2a$10$...` (60 chars) |
| Hash time | ~100ms |

### Security Notes
- Salt is embedded in hash (no separate storage)
- 10 rounds is minimum recommended for production
- No password complexity requirements enforced

## User ID Generation

```javascript
import { randomUUID } from "crypto";
const userId = randomUUID();
```

- Uses Node.js built-in `crypto.randomUUID()`
- UUID v4 format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- Cryptographically random

## Activation Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  AuthRegister   │────▶│   AdminUsers    │────▶│   AuthLogin     │
│                 │     │   (PUT)         │     │                 │
│ Creates user    │     │ Sets role/status│     │ Checks role     │
│ (no role)       │     │                 │     │ exists          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Creates              Activates              Allows login
```

1. User registers → `{ userId, username, passwordHash, createdAt }`
2. Admin approves → adds `{ role: "user", status: "active" }`
3. User can login → AuthLogin checks `role` exists

## Validation Gaps

| Field | Missing Validation |
|-------|-------------------|
| username | No format check (spaces, special chars allowed) |
| username | No length limits |
| password | No minimum length |
| password | No complexity requirements |
| email | Not collected at registration |

## Race Condition

```
Time    User A                    User B
─────────────────────────────────────────────────
T1      Query: "john" not found
T2                                Query: "john" not found
T3      Put: creates "john"
T4                                Put: creates "john" (overwrites!)
```

**Issue:** No conditional write - concurrent registrations with same username can overwrite.

**Fix:** Use `ConditionExpression: "attribute_not_exists(userId)"` on PutCommand.

## CORS Headers

```json
{
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-user-id",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
}
```

## Example

### Request
```bash
curl -X POST https://api.example.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "johndoe", "password": "secret123"}'
```

### Response
```json
{
  "message": "User registered successfully. Awaiting activation by admin.",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Security Considerations

| Issue | Severity | Description |
|-------|----------|-------------|
| No password policy | Medium | Accepts any password including empty-ish |
| No rate limiting | Medium | Vulnerable to registration spam |
| Race condition | Low | Concurrent same-username registrations |
| Username enumeration | Low | 409 reveals if username exists |

## Related Functions

| Function | Relationship |
|----------|--------------|
| AuthLogin | Authenticates registered users |
| AdminUsers | Activates registered users |
| UsersGetProfile | Retrieves user profile |
| UsersUpdatePassword | Changes password post-registration |
