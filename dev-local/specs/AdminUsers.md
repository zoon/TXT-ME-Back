# AdminUsers

Admin endpoint for listing and managing users. Handles user activation workflow.

## Overview

| Property | Value |
|----------|-------|
| **AWS Name** | `CMS-AdminUsers` |
| **Handler** | `auth/AdminUsers/index.mjs` |
| **Runtime** | Node.js (ES Modules) |
| **HTTP Methods** | GET, PUT |
| **Authentication** | `x-user-id` header (no JWT) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-dynamodb` | DynamoDB client |
| `@aws-sdk/lib-dynamodb` | Document client wrapper |

## Security Warning

**This endpoint has no real authorization:**
- Only checks if `x-user-id` header exists
- Does NOT verify the user is actually an admin
- Does NOT validate JWT token
- Any request with `x-user-id: anything` passes auth

## GET - List Users by Status

### Request

```
GET /admin/users?status=pending
```

| Header | Required | Description |
|--------|----------|-------------|
| `x-user-id` | Yes | Any non-empty value (not validated) |

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `status` | string | `pending` | Filter by user status |

### Response

#### 200 OK
```json
{
  "users": [
    {
      "userId": "uuid",
      "username": "string",
      "status": "pending",
      "role": "user (if set)",
      "createdAt": "ISO string",
      "updatedAt": "ISO string"
    }
  ],
  "count": 1
}
```

**Note:** `password` field stripped from response (but field may be `passwordHash` in actual data).

### Database Operation

```
ScanCommand with FilterExpression: #status = :status
```

Full table scan - O(n) regardless of result size.

---

## PUT - Update User Status/Role

### Request

```
PUT /admin/users/{userId}
```

| Header | Required | Description |
|--------|----------|-------------|
| `x-user-id` | Yes | Any non-empty value (not validated) |

| Path Param | Type | Required | Description |
|------------|------|----------|-------------|
| `userId` | string | Yes | Target user's ID |

### Body
```json
{
  "status": "active",
  "role": "user"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No* | New status value |
| `role` | string | No* | New role value |

*At least one of `status` or `role` required.

### Response

#### 200 OK - User Updated
```json
{
  "userId": "uuid",
  "username": "string",
  "status": "active",
  "role": "user",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

Returns full user object (minus password) via `ReturnValues: "ALL_NEW"`.

#### 400 Bad Request - Missing User ID
```json
{
  "error": "User ID is required"
}
```

#### 400 Bad Request - No Fields to Update
```json
{
  "error": "Status or role is required"
}
```

---

## Common Responses

### 401 Unauthorized - Missing Header
```json
{
  "error": "Unauthorized"
}
```
Returned when `x-user-id` header is missing.

### 405 Method Not Allowed
```json
{
  "error": "Method not allowed"
}
```
Returned for non-GET/PUT methods.

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Database Access

### Table: CMS-Users

| Operation | Method | Notes |
|-----------|--------|-------|
| ScanCommand | GET | Full table scan with filter |
| UpdateCommand | PUT | Direct key update |

### User Activation Flow

```
1. User registers → status: undefined, role: undefined
2. Admin lists pending → GET ?status=pending
3. Admin approves → PUT { status: "active", role: "user" }
4. User can now login (AuthLogin checks role exists)
```

## Flow Diagrams

### GET Flow
```
1. Check x-user-id header exists → 401 if missing
2. Get status from query params (default: 'pending')
3. Scan CMS-Users with status filter
4. Strip password field from each user
5. Return users array with count
```

### PUT Flow
```
1. Check x-user-id header exists → 401 if missing
2. Get targetUserId from path params → 400 if missing
3. Parse body for status and role → 400 if neither present
4. Build dynamic UpdateExpression
5. Execute UpdateCommand with ReturnValues: ALL_NEW
6. Strip password from result
7. Return updated user
```

## Dynamic Update Expression

The PUT handler builds the expression dynamically:

```javascript
// Both fields
"SET #status = :status, #role = :role"

// Status only
"SET #status = :status"

// Role only
"SET #role = :role"
```

Uses `ExpressionAttributeNames` to handle reserved word `status`.

## CORS Headers

```json
{
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
}
```

**Note:** Missing `Access-Control-Allow-Headers` and `Access-Control-Allow-Methods`.

## Examples

### List Pending Users
```bash
curl -X GET "https://api.example.com/admin/users?status=pending" \
  -H "x-user-id: admin-123"
```

### Activate User
```bash
curl -X PUT "https://api.example.com/admin/users/user-456" \
  -H "x-user-id: admin-123" \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "role": "user"}'
```

### Promote to Admin
```bash
curl -X PUT "https://api.example.com/admin/users/user-456" \
  -H "x-user-id: admin-123" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

## Security Issues Summary

| Issue | Severity | Description |
|-------|----------|-------------|
| No admin verification | Critical | Any x-user-id value grants access |
| No JWT validation | Critical | Bypasses entire auth system |
| Full table scan | Medium | Performance degrades with user count |
| Password field name | Low | Strips `password` but data uses `passwordHash` |

## Related Functions

| Function | Relationship |
|----------|--------------|
| AuthRegister | Creates users (status/role undefined) |
| AuthLogin | Requires role to be set for login |
