# 📋 Avatar API Documentation

## Base URL

```
https://326ltbm205.execute-api.eu-north-1.amazonaws.com/prod
```

---

## API Endpoints

### 1. Upload New Avatar

**Endpoint:** `POST /admin/users/profile/avatar`
**Lambda:** CMS-Users-AddAvatar
**Auth:** JWT Required (Bearer token)

**Request:**

```http
POST /admin/users/profile/avatar
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "dataUrl": "data:image/jpeg;base64,/9j4AAQSkZJRg..."
}
```

**Validation:**
- Allowed formats: JPEG, PNG, GIF (SVG blocked for security)
- Image format: base64 data URL
- Max size: 10KB data URL string (~7KB raw image due to base64 overhead)
- Max dimensions: 2500x2500 pixels (DoS protection)
- Auto-resize: 50x50px
- Max avatars per user: 50

**Response 200:**

```json
{
  "avatar": {
    "avatarId": "1767873680398",
    "dataUrl": "data:image/jpeg;base64,...",
    "uploadedAt": 1767873680398
  },
  "activeAvatarId": "1767873680398"
}
```

**Errors:**
- `400` - Invalid image data / Unsupported format / Image too large / Max 50 avatars reached

---

### 2. Delete Avatar

**Endpoint:** `DELETE /admin/users/profile/avatar/{avatarId}`
**Lambda:** CMS-Users-DeleteAvatar
**Auth:** JWT Required

**Request:**

```http
DELETE /admin/users/profile/avatar/1767873680398
Authorization: Bearer <jwt_token>
```

**Response 200:**

```json
{
  "message": "Avatar deleted",
  "avatarId": "1767873680398"
}
```

**Behavior:**
- Idempotent: returns 200 even if avatarId doesn't exist (DELETE is idempotent per HTTP spec)

**Errors:**
- `409` - Cannot delete active avatar (set another as active first)

---

### 3. Set Active Avatar

**Endpoint:** `PUT /admin/users/profile/avatar/active`
**Lambda:** CMS-Users-SetActiveAvatar
**Auth:** JWT Required

**Request:**

```http
PUT /admin/users/profile/avatar/active
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "avatarId": "1767873680398"
}
```

**Response 200:**

```json
{
  "message": "Active avatar updated",
  "avatarId": "1767873680398"
}
```

**Errors:**
- `404` - Avatar not found

---

### 4. Get User Avatar (Public)

**Endpoint:** `GET /admin/users/{userId}/avatars/{avatarId}`
**Lambda:** CMS-Users-GetUserAvatar
**Auth:** Not required (public)

**Request:**

```http
GET /admin/users/1e05ccde-eea0-4f10-b52e-969678efc2d8/avatars/1767873680398
```

**Response 200:**

```json
{
  "userId": "1e05ccde-eea0-4f10-b52e-969678efc2d8",
  "username": "kattrend",
  "avatarDataUrl": "data:image/jpeg;base64,..." // or null
}
```

**Errors:**
- `404` - User not found

---

### 5. Get User Active Avatar (Named Sub-Resource)

**Endpoint:** `GET /admin/users/{userId}/avatars/active`
**Lambda:** CMS-Users-GetUserAvatar
**Auth:** Not required (public)

**Request:**

```http
GET /admin/users/1e05ccde-eea0-4f10-b52e-969678efc2d8/avatars/active
```

**Response 200:**

```json
{
  "userId": "1e05ccde-eea0-4f10-b52e-969678efc2d8",
  "username": "kattrend",
  "avatarId": "1767873680398",
  "avatarDataUrl": "data:image/jpeg;base64,..." // or null
}
```

**Errors:**
- `404` - User not found

---

### 6. Get Own Profile (with Avatars)

**Endpoint:** `GET /admin/users/profile`
**Lambda:** CMS-Users-GetProfile
**Auth:** JWT Required

**Request:**

```http
GET /admin/users/profile
Authorization: Bearer <jwt_token>
```

**Response 200:**

```json
{
  "userId": "1e05ccde-eea0-4f10-b52e-969678efc2d8",
  "username": "kattrend",
  "role": "SMOTRITEL",
  "email": "kat_trend@mail.ru",
  "avatars": [
    {
      "avatarId": "1767873680398",
      "dataUrl": "data:image/jpeg;base64,...",
      "uploadedAt": 1767873680398
    }
  ],
  "activeAvatarId": "1767873680398",
  "createdAt": 1767283562507,
  "updatedAt": "2026-01-08T12:01:20.398Z"
}
```

---

### 7. Email Management (Bonus Info)

**Endpoints:**
- `PUT /admin/users/profile/email` - Update email
- `DELETE /admin/users/profile/email` - Remove email
- `PUT /admin/users/profile/password` - Change password

---

## Lambda Functions Summary

| Lambda Function           | Endpoint                                 | Method | Auth   |
|---------------------------|------------------------------------------|--------|--------|
| CMS-Users-AddAvatar       | /admin/users/profile/avatar              | POST   | JWT    |
| CMS-Users-DeleteAvatar    | /admin/users/profile/avatar/{avatarId}   | DELETE | JWT    |
| CMS-Users-SetActiveAvatar | /admin/users/profile/avatar/active       | PUT    | JWT    |
| CMS-Users-GetUserAvatar   | /admin/users/{userId}/avatars/{avatarId} | GET    | Public |
| CMS-Users-GetUserActiveAvatar | /admin/users/{userId}/avatars/active     | GET    | Public |
| CMS-Users-GetProfile      | /admin/users/profile                     | GET    | JWT    |
| CMS-Users-UpdateEmail     | /admin/users/profile/email               | PUT    | JWT    |
| CMS-Users-DeleteEmail     | /admin/users/profile/email               | DELETE | JWT    |
| CMS-Users-UpdatePassword  | /admin/users/profile/password            | PUT    | JWT    |
