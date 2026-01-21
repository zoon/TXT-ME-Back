# API Specification

Base URL: `https://326ltbm205.execute-api.eu-north-1.amazonaws.com/prod`

## Auth
| Method | Endpoint        | Auth | Description            |
|--------|-----------------|------|------------------------|
| POST   | /auth/register  | -    | Register new user      |
| POST   | /auth/login     | -    | Login, returns JWT     |

## Admin
| Method | Endpoint     | Auth       | Description      |
|--------|--------------|------------|------------------|
| GET    | /admin/users | x-user-id  | List all users   |
| PUT    | /admin/users | x-user-id  | Activate user    |

## Posts
| Method | Endpoint      | Auth | Description      |
|--------|---------------|------|------------------|
| GET    | /posts        | -    | List posts       |
| POST   | /posts        | JWT  | Create post      |
| GET    | /posts/{id}   | -    | Get single post  |
| PUT    | /posts/{id}   | JWT  | Update post      |
| DELETE | /posts/{id}   | JWT  | Delete post      |
| GET    | /posts/recent | -    | Recent posts     |

## Comments
| Method | Endpoint                            | Auth | Description    |
|--------|-------------------------------------|------|----------------|
| GET    | /posts/{id}/comments                | -    | List comments  |
| POST   | /posts/{id}/comments                | JWT  | Create comment |
| DELETE | /posts/{id}/comments/{commentId}    | JWT  | Delete comment |

## Users - Profile
| Method | Endpoint                                 | Auth | Description       |
|--------|------------------------------------------|------|-------------------|
| GET    | /admin/users/profile                     | JWT  | Get own profile   |
| PUT    | /admin/users/profile/email               | JWT  | Update email      |
| DELETE | /admin/users/profile/email               | JWT  | Remove email      |
| PUT    | /admin/users/profile/password            | JWT  | Change password   |
| POST   | /admin/users/profile/avatar              | JWT  | Upload avatar     |
| DELETE | /admin/users/profile/avatar/{avatarId}   | JWT  | Delete avatar     |
| PUT    | /admin/users/profile/avatar/active       | JWT  | Set active avatar |
| GET    | /admin/users/{userId}/avatars/{avatarId} | -    | Get user's avatar |
| GET    | /admin/users/{userId}/avatars/active     | -    | Get active avatar |


## Authentication

```
Authorization: Bearer <token>
```

## CORS

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization, x-user-id
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```
