# UsersUpdatePassword

Changes user's password. Requires verification of current password.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-UsersUpdatePassword` |
| **Handler** | `users/UsersUpdatePassword/index.js` |
| **Runtime** | Node.js (CommonJS) |
| **HTTP Method** | PUT |
| **Authentication** | Bearer JWT |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-dynamodb` | DynamoDB client |
| `@aws-sdk/lib-dynamodb` | Document client wrapper |
| `jsonwebtoken` | JWT verification |
| `bcryptjs` | Password hashing/verification |

## Configuration

| Setting | Value | Note |
|---------|-------|------|
| Region | `eu-north-1` | Hardcoded |
| JWT Secret | `JWT_SECRET` env | **Required** - throws on startup if missing |

### Startup Validation
```javascript
if (!JWT_SECRET) throw new Error('JWT_SECRET missing');
```

Unlike other functions, this one **fails to deploy** without `JWT_SECRET`.

## Request

### Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Body
```json
{
  "oldPassword": "string",
  "newPassword": "string"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `oldPassword` | string | Yes | Must match current password |
| `newPassword` | string | Yes | Minimum 8 characters |

## Response

### 200 OK - Password Changed
```json
{
  "message": "Password updated successfully"
}
```

### 400 Bad Request - Missing Passwords
```json
{
  "error": "Missing passwords"
}
```

### 400 Bad Request - Password Too Short
```json
{
  "error": "New password must be at least 8 characters"
}
```

### 401 Unauthorized - Missing Token
```json
{
  "error": "Missing token"
}
```

### 401 Unauthorized - Wrong Old Password
```json
{
  "error": "Incorrect old password"
}
```

### 404 Not Found - User Missing
```json
{
  "error": "User not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "error message"
}
```

## Database Access

### Table: CMS-Users

| Operation | Purpose |
|-----------|---------|
| GetCommand | Fetch current passwordHash |
| UpdateCommand | Store new passwordHash |

### Update Expression
```javascript
UpdateExpression: "SET passwordHash = :hash, updatedAt = :now"
ExpressionAttributeValues: {
  ":hash": newHash,
  ":now": new Date().toISOString()
}
```

## Flow

```
1. Extract JWT from Authorization header
2. Verify JWT, extract userId
3. Parse body, validate oldPassword and newPassword present → 400
4. Validate newPassword >= 8 chars → 400
5. Fetch user from CMS-Users → 404 if not found
6. Compare oldPassword with stored passwordHash (bcrypt)
7. If mismatch → 401 "Incorrect old password"
8. Hash newPassword with bcrypt (10 rounds)
9. Update user: passwordHash, updatedAt
10. Return success
```

## Password Validation

### Old Password
```javascript
const isValidOld = await bcrypt.compare(oldPassword, passwordHash);
```

- Constant-time comparison via bcrypt
- Prevents timing attacks

### New Password
```javascript
if (newPassword.length < 8) {
  return 400;
}
```

| Validation | Status |
|------------|--------|
| Minimum length (8) | ✓ Enforced |
| Maximum length | ✗ Not checked |
| Complexity | ✗ Not checked |
| Common passwords | ✗ Not checked |
| Same as old | ✗ Not checked |

## Password Hashing

```javascript
const newHash = await bcrypt.hash(newPassword, 10);
```

| Property | Value |
|----------|-------|
| Algorithm | bcrypt |
| Salt rounds | 10 |
| Hash time | ~100ms |

## Timestamp Format

```javascript
updatedAt: new Date().toISOString()
// Result: "2026-01-13T12:00:00.000Z"
```

**Note:** Uses ISO string, not milliseconds like other functions.

## JWT Secret Handling

| Function | JWT_SECRET Handling |
|----------|---------------------|
| AuthLogin | Fallback to hardcoded |
| PostCreate | Fallback to hardcoded |
| **UsersUpdatePassword** | **Throws if missing** |
| UsersAddAvatar | Hardcoded only |

This function is the **only one** that requires the env var.

## CORS Headers

```json
{
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
}
```

## Example

### Request
```bash
curl -X PUT https://api.example.com/users/password \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"oldPassword": "oldSecret123", "newPassword": "newSecret456"}'
```

### Response
```json
{
  "message": "Password updated successfully"
}
```

## Security Considerations

| Aspect | Status | Notes |
|--------|--------|-------|
| Old password required | ✓ | Prevents unauthorized changes |
| Bcrypt hashing | ✓ | Industry standard |
| Min length enforced | ✓ | 8 characters |
| Token invalidation | ✗ | Old tokens still work |
| Rate limiting | ✗ | Vulnerable to brute force |
| Password history | ✗ | Can reuse old passwords |

### Token Behavior

After password change:
- Existing JWT tokens **remain valid** until expiration
- No mechanism to invalidate active sessions
- User should re-login for new token (not enforced)

## Related Functions

| Function | Relationship |
|----------|--------------|
| AuthRegister | Sets initial password |
| AuthLogin | Verifies password for login |
| UsersGetProfile | Returns user (without passwordHash) |
