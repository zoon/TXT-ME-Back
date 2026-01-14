# NotificationsPostsStream

DynamoDB Streams processor for post notifications. Triggers email notifications when posts mention users.

## Overview

| Property           | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **AWS Name**       | `CMS-Notifications-PostsStream`                                 |
| **Handler**        | `notifications/NotofocationsPostsStream/processPostsStream.mjs` |
| **Runtime**        | Node.js (ES Modules)                                            |
| **Trigger**        | DynamoDB Streams (CMS-Posts table)                              |
| **Authentication** | None (internal service)                                         |

**Note:** Directory name has typos: "Notofocations" instead of "Notifications"

## Dependencies

| Package                    | Purpose                   |
| -------------------------- | ------------------------- |
| `@aws-sdk/client-dynamodb` | DynamoDB client           |
| `@aws-sdk/lib-dynamodb`    | Document client wrapper   |
| `@aws-sdk/client-lambda`   | Lambda invocation         |
| `@aws-sdk/util-dynamodb`   | Unmarshall stream records |

## Configuration

| Setting       | Value                         | Note                    |
| ------------- | ----------------------------- | ----------------------- |
| Region        | `eu-north-1`                  | Hardcoded               |
| Target Lambda | `CMS-Notifications-SendEmail` | Hardcoded function name |

## Input

DynamoDB Streams event with records from CMS-Posts table.

### Stream Event Structure

```json
{
  "Records": [
    {
      "eventName": "INSERT | MODIFY",
      "dynamodb": {
        "NewImage": {
          "postId": { "S": "uuid" },
          "userId": { "S": "uuid" },
          "username": { "S": "string" },
          "title": { "S": "string" },
          "content": { "S": "string" }
        }
      }
    }
  ]
}
```

## Response

### 200 OK

```json
{
  "statusCode": 200,
  "body": "OK"
}
```

Always returns 200, even if individual records fail.

## Flow

```
For each stream record:

1. Check eventName === 'INSERT' or 'MODIFY' (skip REMOVE)
2. Unmarshall DynamoDB record to plain object
3. Extract @mentions from post content
4. If mentions found:
   - Invoke SendEmail Lambda with POST_MENTION type
5. Continue to next record (errors don't stop processing)
```

## Notification Triggers

### POST_MENTION

Triggered when post content contains @mentions.

**Recipients:** All mentioned users (resolved by SendEmail handler)

**Payload:**

```json
{
  "type": "POST_MENTION",
  "data": {
    "authorUsername": "post-author",
    "postTitle": "Post Title",
    "postUrl": "https://txt-me.club/posts/{postId}",
    "content": "full post content with @mentions"
  }
}
```

## Mention Extraction

Regex pattern: `/@([a-zA-Z0-9_-]+)/g`

Same pattern as SendEmail handler. Mentions are deduplicated.

Examples:

- `Check out @alice's work` → `["alice"]`
- `Thanks @bob and @carol` → `["bob", "carol"]`
- `@user-1 @user-1` → `["user-1"]` (deduplicated)

## Lambda Invocation

```javascript
await lambdaClient.send(
  new InvokeCommand({
    FunctionName: 'CMS-Notifications-SendEmail',
    InvocationType: 'Event', // Async, fire-and-forget
    Payload: JSON.stringify({ type, data }),
  })
);
```

**InvocationType: 'Event'** means:

- Async invocation
- Does not wait for response
- Failures don't affect this handler

## Event Types Processed

| Event  | Action                          |
| ------ | ------------------------------- |
| INSERT | Check mentions, notify if found |
| MODIFY | Check mentions, notify if found |
| REMOVE | Ignored                         |

**MODIFY handling:** When a post is edited, mentions are re-checked. This means:

- New mentions get notified
- Previously-notified users may get duplicate notifications
- No tracking of "already notified" state

## Error Handling

| Error Type              | Behavior                           |
| ----------------------- | ---------------------------------- |
| Unmarshall fails        | Log error, continue to next record |
| Lambda invocation fails | Log error, continue                |
| No mentions found       | Skip notification, continue        |

Errors are isolated per record.

## Known Issues

1. **Directory Name Typo**: "NotofocationsPostsStream" instead of "NotificationsPostsStream"
2. **No Package.json**: Directory missing `package.json`
3. **Duplicate on Edit**: Editing post re-notifies all mentions
4. **Hardcoded URL**: `txt-me.club` hardcoded, not configurable
5. **Missing Stream Config**: DynamoDB Streams not configured in Terraform
6. **Self-Mention**: Author can mention themselves and get notified

## Infrastructure Requirements

DynamoDB Streams must be enabled on CMS-Posts table:

```hcl
stream_enabled   = true
stream_view_type = "NEW_IMAGE"
```

Lambda trigger must be configured to invoke this handler on stream events.

## Comparison with CommentsStream

| Aspect        | PostsStream       | CommentsStream                  |
| ------------- | ----------------- | ------------------------------- |
| Events        | INSERT, MODIFY    | INSERT only                     |
| Notifications | POST_MENTION only | COMMENT_REPLY + COMMENT_MENTION |
| DB Lookups    | None              | Post + Parent Comment           |
| Complexity    | Simple            | More complex                    |

## Related Functions

| Function               | Relationship                           |
| ---------------------- | -------------------------------------- |
| NotificationsSendEmail | Called to send actual emails           |
| PostCreate             | Creates posts that trigger this stream |
| PostUpdate             | Updates posts that trigger this stream |
