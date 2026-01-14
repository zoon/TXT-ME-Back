# UsersAddAvatar

Uploads a new avatar image for the authenticated user. Automatically sets it as active.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-UsersAddAvatar` |
| **Handler** | `users/UsersAddAvatar/index.js` |
| **Runtime** | Node.js (CommonJS) |
| **HTTP Method** | POST |
| **Authentication** | Bearer JWT |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-dynamodb` | DynamoDB client |
| `@aws-sdk/lib-dynamodb` | Document client wrapper |
| `jsonwebtoken` | JWT verification |

## Configuration

| Setting | Value | Note |
|---------|-------|------|
| Region | `eu-north-1` | Hardcoded |
| JWT Secret | `cms-jwt-secret-prod-2025` | Env var with fallback |

## Request

### Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Body
```json
{
  "dataUrl": "data:image/png;base64,iVBORw0KGgo..."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `dataUrl` | string | Yes | Must start with `data:image`, max 10,000 characters |

### Size Calculation
- Max `dataUrl` length: 10,000 characters
- Base64 overhead: ~33%
- **Effective max image size: ~7.5KB raw**

## Response

### 200 OK - Avatar Added
```json
{
  "avatar": {
    "avatarId": "1704456000000",
    "dataUrl": "data:image/png;base64,iVBORw0KGgo...",
    "uploadedAt": 1704456000000
  },
  "activeAvatarId": "1704456000000"
}
```

### 400 Bad Request - Invalid Image
```json
{
  "error": "Invalid/large image (max 10KB)"
}
```
Returned when:
- `dataUrl` is missing
- `dataUrl` doesn't start with `data:image`
- `dataUrl` exceeds 10,000 characters

### 400 Bad Request - Limit Reached
```json
{
  "error": "Max 50 avatars"
}
```

### 401 Unauthorized - Invalid Token
JWT verification failure (implicit - throws to 500).

### 500 Internal Server Error
```json
{
  "error": "Internal error"
}
```

## Database Access

### Table: CMS-Users

**Read Operation:**
```
GetCommand: Key = { userId }
```

**Update Operation:**
```
UpdateExpression: SET avatars = :avatars, activeAvatarId = :active, updatedAt = :now
```

### User Document Structure
```json
{
  "userId": "uuid",
  "avatars": [
    {
      "avatarId": "timestamp-string",
      "dataUrl": "data:image/...",
      "uploadedAt": 1704456000000
    }
  ],
  "activeAvatarId": "timestamp-string",
  "updatedAt": "2026-01-05T12:00:00.000Z"
}
```

## Flow

```
1. Extract and verify JWT from Authorization header
2. Parse request body, extract dataUrl
3. Validate dataUrl:
   - Must be present
   - Must start with "data:image"
   - Must be ≤ 10,000 characters
4. Fetch user document from CMS-Users
5. Check avatar count (max 50)
6. Create avatar object with timestamp ID
7. Append to avatars array
8. Update user: avatars, activeAvatarId, updatedAt
9. Return new avatar and activeAvatarId
```

## Avatar ID Generation

```javascript
avatarId: Date.now().toString()  // e.g., "1704456000000"
```

- Uses millisecond timestamp as string
- Unique within user (can't upload 2 in same ms)
- Sortable chronologically

## Automatic Activation

New avatars are **always set as active**:
- `activeAvatarId` updated to new avatar's ID
- No option to upload without activating
- Use `UsersSetActiveAvatar` to switch back

## Constraints Summary

| Constraint | Value | Enforced |
|------------|-------|----------|
| Max avatars per user | 50 | Application check |
| Max dataUrl length | 10,000 chars | Application check |
| Image format | data:image/* | Prefix check only |
| Valid base64 | Not validated | Could store invalid data |

## Security Notes

| Issue | Severity | Description |
|-------|----------|-------------|
| Hardcoded region | Low | Region hardcoded to `eu-north-1` |
| No image validation | Medium | Only checks prefix, not actual image data |
| No content-type validation | Low | Accepts any `data:image/*` mime type |

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
curl -X POST https://api.example.com/users/avatar \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}'
```

### Response
```json
{
  "avatar": {
    "avatarId": "1704456000000",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "uploadedAt": 1704456000000
  },
  "activeAvatarId": "1704456000000"
}
```

## Related Functions

| Function | Relationship |
|----------|--------------|
| UsersSetActiveAvatar | Switch to different avatar |
| UsersDeleteAvatar | Remove an avatar (not active one) |
| UsersGetUserAvatar | Fetch user's avatars (public) |
| UsersGetProfile | Returns full profile including avatars |
