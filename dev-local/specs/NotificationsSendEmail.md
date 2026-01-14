# NotificationsSendEmail

Sends email notifications via AWS SES. Handles mentions and comment replies.

## Overview

| Property           | Value                                            |
| ------------------ | ------------------------------------------------ |
| **AWS Name**       | `CMS-Notifications-SendEmail`                    |
| **Handler**        | `notifications/NotoficationsSendEmail/index.mjs` |
| **Runtime**        | Node.js (ES Modules)                             |
| **Trigger**        | Lambda invocation (async)                        |
| **Authentication** | None (internal service)                          |

**Note:** Directory name has typo: "Notofications" instead of "Notifications"

## Dependencies

| Package                    | Purpose                 |
| -------------------------- | ----------------------- |
| `@aws-sdk/client-ses`      | SES email sending       |
| `@aws-sdk/client-dynamodb` | DynamoDB client         |
| `@aws-sdk/lib-dynamodb`    | Document client wrapper |

## Configuration

| Setting      | Value            | Note                 |
| ------------ | ---------------- | -------------------- |
| Region       | `eu-north-1`     | Hardcoded            |
| Email Source | `noreply@txt-me` | Must be SES-verified |

## Input

Invoked directly by stream processors (not HTTP). Accepts event body or direct payload.

### Payload Structure

```json
{
  "type": "POST_MENTION | COMMENT_REPLY | COMMENT_MENTION",
  "data": { ... }
}
```

### Notification Types

#### POST_MENTION

User mentioned in a post via `@username`.

```json
{
  "type": "POST_MENTION",
  "data": {
    "authorUsername": "string",
    "postTitle": "string",
    "postUrl": "string",
    "content": "string"
  }
}
```

#### COMMENT_REPLY

Reply to a user's post or comment.

```json
{
  "type": "COMMENT_REPLY",
  "data": {
    "authorUsername": "string",
    "authorUserId": "string",
    "postTitle": "string",
    "postUrl": "string",
    "postAuthorUserId": "string",
    "parentCommentAuthorUserId": "string (optional)",
    "parentCommentAuthorUsername": "string (optional)"
  }
}
```

#### COMMENT_MENTION

User mentioned in a comment via `@username`.

```json
{
  "type": "COMMENT_MENTION",
  "data": {
    "authorUsername": "string",
    "postTitle": "string",
    "postUrl": "string",
    "content": "string"
  }
}
```

## Response

### 200 OK - Notifications Sent

```json
{
  "message": "Notifications sent",
  "count": 3
}
```

### 500 Internal Server Error

```json
{
  "error": "error message"
}
```

## Database Access

### Tables Used

| Table     | Operation    | Purpose                           |
| --------- | ------------ | --------------------------------- |
| CMS-Users | GetCommand   | Fetch email by userId             |
| CMS-Users | QueryCommand | Fetch email by username (via GSI) |

### GSI Used

| Index          | Table     | Purpose                           |
| -------------- | --------- | --------------------------------- |
| username-index | CMS-Users | Lookup users by @mention username |

## Flow

```
1. Parse event body (JSON string or direct object)
2. Switch on notification type:

   POST_MENTION:
   a. Extract @mentions from content using regex
   b. Query CMS-Users by username to get emails
   c. Build email: "{author} упомянул вас в тексте"

   COMMENT_REPLY:
   a. Get post author's email (if different from comment author)
   b. Get parent comment author's email (if exists and different)
   c. Deduplicate recipients
   d. Build email: "{author} ответил на ваш текст"

   COMMENT_MENTION:
   a. Extract @mentions from content
   b. Query CMS-Users by username to get emails
   c. Build email: "{author} упомянул вас в комментарии"

3. Send individual emails via SES (continues on failure)
4. Return count of successfully sent emails
```

## Mention Extraction

Regex pattern: `/@([a-zA-Z0-9_-]+)/g`

Extracts usernames from content like:

- `Hello @alice and @bob` → `["alice", "bob"]`
- `@user-123 check this` → `["user-123"]`

Mentions are deduplicated before lookup.

## Email Templates

All emails are in Russian:

| Type            | Subject                               | Body                                                                                           |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| POST_MENTION    | `{author} упомянул вас в тексте`      | Пользователь {author} упомянул вас в тексте "{title}" по ссылке {url}                          |
| COMMENT_REPLY   | `{author} ответил на ваш текст`       | Пользователь {author} ответил на ваш текст "{title}" [на комментарий {parent}] по ссылке {url} |
| COMMENT_MENTION | `{author} упомянул вас в комментарии` | Пользователь {author} упомянул вас в комментарии к тексту "{title}" по ссылке {url}            |

## Error Handling

| Error Type        | Behavior                    |
| ----------------- | --------------------------- |
| Invalid type      | No emails sent, returns 200 |
| User not found    | Skipped, continues to next  |
| User has no email | Skipped, continues to next  |
| SES send fails    | Logged, continues to next   |
| Parse error       | Returns 500                 |

## Recipient Resolution

### POST_MENTION / COMMENT_MENTION

1. Extract @usernames from content
2. Query `username-index` GSI for each
3. Collect emails from found users
4. Skip users without email

### COMMENT_REPLY

1. Get post author email via GetCommand (by userId)
2. Get parent comment author email if exists
3. Exclude comment author from recipients
4. Deduplicate email list

## Known Issues

1. **SES Verification Required**: Email source `noreply@txt-me` must be verified in SES
2. **No HTML Emails**: Only plain text body sent
3. **No Batching**: Emails sent one-by-one (inefficient for many recipients)
4. **Missing User Handling**: No notification if mentioned user doesn't exist
5. **Self-Mention**: User can receive notification for mentioning themselves

## Related Functions

| Function                    | Relationship                            |
| --------------------------- | --------------------------------------- |
| NotificationsCommentsStream | Invokes this handler for comment events |
| NotificationsPostsStream    | Invokes this handler for post events    |
