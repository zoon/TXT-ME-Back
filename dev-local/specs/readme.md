# Lambda Functions Specification

20 AWS Lambda functions organized by domain. All deploy with `CMS-` prefix.

---

## Auth (3 functions)

### AuthRegister
|------------|-------------------------------|
| **Path**   | `auth/AuthRegister/index.mjs` |
| **Method** | POST                          |
| **Auth**   | None                          |

Creates inactive user (requires admin approval).

**Input:**
```json
{ "username": "string", "password": "string" }
```

**Output:** `201` with `{ message, userId }` | `409` username exists

---

### AuthLogin
|------------|----------------------------|
| **Path**   | `auth/AuthLogin/index.mjs` |
| **Method** | POST                       |
| **Auth**   | None                       |

Returns JWT token (1h expiry). Rejects inactive users.

**Input:**
```json
{ "username": "string", "password": "string" }
```

**Output:** `200` with `{ token, user: { userId, username, role } }` | `401` invalid/inactive

---

### AdminUsers
|------------|-----------------------------|
| **Path**   | `auth/AdminUsers/index.mjs` |
| **Method** | GET, PUT                    |
| **Auth**   | `x-user-id` header          |

- **GET**: List users by status. Query: `?status=pending|active`
- **PUT**: Update user role/status. Path: `/{userId}`, Body: `{ status, role }`

**Output:** GET `{ users[], count }` | PUT updated user object

---

## Posts (6 functions)

### PostCreate
|------------|------------------------------|
| **Path**   | `posts/PostCreate/index.mjs` |
| **Method** | POST                         |
| **Auth**   | Bearer JWT                   |

Creates post. Auto-fetches user's active avatar if `postAvatarId` not provided.

**Input:**
```json
{ "title": "string", "content": "string", "tags": ["tagId"], "postAvatarId": "optional" }
```

**Output:** `201` with `{ post: { postId, userId, username, title, content, tags, createdAt, commentCount, postAvatarId } }`

---

### PostUpdate
|------------|------------------------------|
| **Path**   | `posts/PostUpdate/index.mjs` |
| **Method** | PUT                          |
| **Auth**   | Bearer JWT                   |

Updates post (owner only). Path: `/{postId}`

**Input:**
```json
{ "title?": "string", "content?": "string", "tags?": ["tagId"], "postAvatarId?": "string" }
```

**Output:** `200` | `403` not owner | `404` not found

---

### PostDelete
|------------|------------------------------|
| **Path**   | `posts/PostDelete/index.mjs` |
| **Method** | DELETE                       |
| **Auth**   | Bearer JWT                   |

Deletes post and all associated comments (batch, max 25/batch). Path: `/{postId}`

**Output:** `200` with `{ postId, deletedComments }` | `403` not owner

---

### PostsList
|------------|-----------------------------|
| **Path**   | `posts/PostsList/index.mjs` |
| **Method** | GET                         |
| **Auth**   | None                        |

Lists posts (newest first). Supports tag filtering and cursor pagination.

**Query params:** `tagId`, `limit` (default 20, max 100), `lastKey`

**Output:** `{ posts[], count, nextKey }`

---

### PostsGet
|------------|----------------------------|
| **Path**   | `posts/PostsGet/index.mjs` |
| **Method** | GET                        |
| **Auth**   | None                       |

Fetch single post. Path: `/{postId}`

**Output:** `{ post }` | `404` not found

---

### PostsRecent
|------------|-------------------------------|
| **Path**   | `posts/PostsRecent/index.mjs` |
| **Method** | GET                           |
| **Auth**   | None                          |

Fetches posts and comments created since timestamp (for real-time updates).

**Query params:** `since` (ISO string or ms timestamp, required)

**Output:** `{ newPosts[], newComments[], summary: { totalNewPosts, totalNewComments } }`

---

## Comments (3 functions)

### CommentCreate
|------------|------------------------------------|
| **Path**   | `comments/CommentCreate/index.mjs` |
| **Method** | POST                               |
| **Auth**   | Bearer JWT                         |

Creates comment. Supports nesting via `parentCommentId`. Increments post's `commentCount`.

**Input:**
```json
{ "content": "string", "parentCommentId?": "string", "commentAvatarId?": "string" }
```

**Output:** `201` with `{ comment: { commentId, postId, userId, username, content, createdAt, parentCommentId, commentAvatarId } }`

---

### CommentDelete
|------------|------------------------------------|
| **Path**   | `comments/CommentDelete/index.mjs` |
| **Method** | DELETE                             |
| **Auth**   | Bearer JWT                         |

Deletes comment (owner only). Decrements post's `commentCount`. Path: `/{commentId}`

**Output:** `200` with `{ commentId, postId }` | `403` not owner

---

### CommentsList
|------------|-----------------------------------|
| **Path**   | `comments/CommentsList/index.mjs` |
| **Method** | GET                               |
| **Auth**   | None                              |

Lists comments for post (oldest first). Path: `/posts/{postId}/comments`

**Query params:** `limit` (default 50, max 100), `lastKey`

**Output:** `{ comments[], count, nextKey }`

---

## Users (8 functions)

### UsersGetProfile
|------------|-----------------------------------|
| **Path**   | `users/UsersGetProfile/index.mjs` |
| **Method** | GET                               |
| **Auth**   | Bearer JWT                        |

Returns authenticated user's profile (excludes passwordHash).

**Output:** `{ userId, username, email, avatars[], activeAvatarId, createdAt, updatedAt, ... }`

---

### UsersAddAvatar
|------------|---------------------------------|
| **Path**   | `users/UsersAddAvatar/index.js` |
| **Method** | POST                            |
| **Auth**   | Bearer JWT                      |

Adds avatar (base64 data URL). Max 10KB, limit 50 per user. Auto-sets as active.

**Input:**
```json
{ "dataUrl": "data:image/..." }
```

**Output:** `{ avatar: { avatarId, dataUrl, uploadedAt }, activeAvatarId }`

---

### UsersSetActiveAvatar
|------------|---------------------------------------|
| **Path**   | `users/UsersSetActiveAvatar/index.js` |
| **Method** | PUT                                   |
| **Auth**   | Bearer JWT                            |

Sets active avatar. Path: `/{avatarId}`

**Output:** `{ message, avatarId }` | `404` avatar not found

---

### UsersDeleteAvatar
|------------|------------------------------------|
| **Path**   | `users/UsersDeleteAvatar/index.js` |
| **Method** | DELETE                             |
| **Auth**   | Bearer JWT                         |

Deletes avatar. Cannot delete active avatar. Path: `/{avatarId}`

**Output:** `{ message, avatarId }` | `400` cannot delete active

---

### UsersGetUserAvatar
|------------|-------------------------------------|
| **Path**   | `users/UsersGetUserAvatar/index.js` |
| **Method** | GET                                 |
| **Auth**   | None (public)                       |

Fetches user's avatars and active avatar data. Path: `/{userId}`

**Output:** `{ userId, username, avatars[], activeAvatarId, avatarDataUrl }` | `404` user not found

---

### UsersUpdateEmail
|------------|-----------------------------------|
| **Path**   | `users/UsersUpdateEmail/index.js` |
| **Method** | PUT                               |
| **Auth**   | Bearer JWT                        |

Updates email. Validates format (must contain `@`).

**Input:**
```json
{ "email": "user@example.com" }
```

**Output:** `{ message, email }`

---

### UsersDeleteEmail
|------------|-----------------------------------|
| **Path**   | `users/UsersDeleteEmail/index.js` |
| **Method** | DELETE                            |
| **Auth**   | Bearer JWT                        |

Removes email from profile.

**Output:** `{ message }`

---

### UsersUpdatePassword
|            |                                      |
|------------|--------------------------------------|
| **Path**   | `users/UsersUpdatePassword/index.js` |
| **Method** | PUT                                  |
| **Auth**   | Bearer JWT                           |

Updates password. Verifies old password. Min 8 chars for new.

**Input:**
```json
{ "oldPassword": "string", "newPassword": "string" }
```

**Output:** `{ message }` | `401` wrong old password

---

## Quick Reference

| Function             | Method  | Auth      | Public |
|----------------------|---------|-----------|--------|
| AuthRegister         | POST    | -         | Yes    |
| AuthLogin            | POST    | -         | Yes    |
| AdminUsers           | GET/PUT | x-user-id | No     |
| PostCreate           | POST    | JWT       | No     |
| PostUpdate           | PUT     | JWT       | No     |
| PostDelete           | DELETE  | JWT       | No     |
| PostsList            | GET     | -         | Yes    |
| PostsGet             | GET     | -         | Yes    |
| PostsRecent          | GET     | -         | Yes    |
| CommentCreate        | POST    | JWT       | No     |
| CommentDelete        | DELETE  | JWT       | No     |
| CommentsList         | GET     | -         | Yes    |
| UsersGetProfile      | GET     | JWT       | No     |
| UsersAddAvatar       | POST    | JWT       | No     |
| UsersSetActiveAvatar | PUT     | JWT       | No     |
| UsersDeleteAvatar    | DELETE  | JWT       | No     |
| UsersGetUserAvatar   | GET     | -         | Yes    |
| UsersUpdateEmail     | PUT     | JWT       | No     |
| UsersDeleteEmail     | DELETE  | JWT       | No     |
| UsersUpdatePassword  | PUT     | JWT       | No     |

---

## Database Tables

| Table        | Hash Key  | GSIs                             |
|--------------|-----------|----------------------------------|
| CMS-Users    | userId    | username-index                   |
| CMS-Posts    | postId    | userId-index, createdAt-index    |
| CMS-Comments | commentId | postId-index (+ createdAt range) |
| CMS-Tags     | tagId     | name-index                       |

---

## Known Issues

Discovered during detailed spec review. See individual `.specs/*.md` files for details.

### Critical: JWT Secret Inconsistency

Three different fallback secrets - cross-function auth will fail:

**`cms-jwt-secret-prod-2025`** (12 functions)
AuthLogin, AuthRegister, PostCreate, PostUpdate, PostDelete, CommentCreate, CommentDelete, UsersGetProfile, UsersAddAvatar, UsersDeleteAvatar, UsersUpdateEmail, UsersUpdatePassword

**`cms-jwt-secret-change-in-production`** (1 function)
UsersSetActiveAvatar

**`your-secret-key-here`** (1 function)
UsersDeleteEmail

### Critical: AdminUsers No Auth

`AdminUsers` only checks for `x-user-id` header presence - any value grants full admin access.

### Data Inconsistencies

| Issue                                     | Affected Functions                                             |
|-------------------------------------------|----------------------------------------------------------------|
| `updatedAt` as ISO string vs Unix ms      | User functions use ISO, Post/Comment use Unix                  |
| JWT userId extraction (`sub` vs `userId`) | Most use both, UsersGetProfile uses only `userId`              |
| Missing 404 for non-existent items        | UsersDeleteAvatar, CommentsList (empty array for missing post) |

### Validation Gaps

- Tag IDs not validated against CMS-Tags table
- Email validation only checks for `@` character
- No email uniqueness enforcement
