# NotificationsCommentsStream

DynamoDB Streams processor for comment notifications. Triggers email notifications on new comments.

## Overview

| Property           | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| **AWS Name**       | `CMS-Notifications-CommentsStream`                                    |
| **Handler**        | `notifications/NotificationsCommentsStream/processCommentsStream.mjs` |
| **Runtime**        | Node.js (ES Modules)                                                  |
| **Trigger**        | DynamoDB Streams (CMS-Comments table)                                 |
| **Authentication** | None (internal service)                                               |

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

DynamoDB Streams event with records from CMS-Comments table.

### Stream Event Structure

```json
{
  "Records": [
    {
      "eventName": "INSERT",
      "dynamodb": {
        "NewImage": {
          "commentId": { "S": "uuid" },
          "postId": { "S": "uuid" },
          "userId": { "S": "uuid" },
          "username": { "S": "string" },
          "content": { "S": "string" },
          "parentCommentId": { "S": "uuid (optional)" }
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

## Database Access

### Tables Used

| Table        | Operation    | Purpose                                    |
| ------------ | ------------ | ------------------------------------------ |
| CMS-Posts    | GetCommand   | Fetch post metadata for notification       |
| CMS-Comments | QueryCommand | Find parent comment (for threaded replies) |

### GSI Used

| Index        | Table        | Purpose                                 |
| ------------ | ------------ | --------------------------------------- |
| postId-index | CMS-Comments | Query comments by postId to find parent |

## Flow

```
For each stream record:

1. Check eventName === 'INSERT' (skip MODIFY/REMOVE)
2. Unmarshall DynamoDB record to plain object
3. Fetch parent post from CMS-Posts
   - Skip if post not found
4. If parentCommentId exists:
   a. Query CMS-Comments via postId-index
   b. Find parent comment in results
   c. Extract parent author info
5. Invoke SendEmail Lambda with COMMENT_REPLY:
   - Post author gets notified (if not comment author)
   - Parent comment author gets notified (if exists, different from both)
6. Extract @mentions from comment content
7. If mentions found, invoke SendEmail Lambda with COMMENT_MENTION
8. Continue to next record (errors don't stop processing)
```

## Notification Triggers

### COMMENT_REPLY

Triggered for every new comment.

**Recipients:**

- Post author (if different from comment author)
- Parent comment author (if exists and different from both)

**Payload:**

```json
{
  "type": "COMMENT_REPLY",
  "data": {
    "authorUsername": "commenter",
    "authorUserId": "comment-author-id",
    "postTitle": "Post Title",
    "postUrl": "https://txt-me.club/posts/{postId}",
    "postAuthorUserId": "post-author-id",
    "parentCommentAuthorUserId": "parent-author-id (if exists)",
    "parentCommentAuthorUsername": "parent-author (if exists)"
  }
}
```

### COMMENT_MENTION

Triggered if comment contains @mentions.

**Payload:**

```json
{
  "type": "COMMENT_MENTION",
  "data": {
    "authorUsername": "commenter",
    "postTitle": "Post Title",
    "postUrl": "https://txt-me.club/posts/{postId}",
    "content": "full comment text with @mentions"
  }
}
```

## Mention Extraction

Regex pattern: `/@([a-zA-Z0-9_-]+)/g`

Same pattern as SendEmail handler. Mentions are deduplicated.

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

## Parent Comment Lookup

**Problem:** Comments table has `commentId` as hash key, no direct lookup by ID.

**Solution:** Query by postId-index, then filter in memory:

```javascript
const result = await dynamodb.send(
  new QueryCommand({
    TableName: 'CMS-Comments',
    IndexName: 'postId-index',
    KeyConditionExpression: 'postId = :postId',
    ExpressionAttributeValues: { ':postId': comment.postId },
  })
);

const parent = result.Items?.find((c) => c.commentId === parentCommentId);
```

**Note:** Inefficient for posts with many comments.

## Error Handling

| Error Type               | Behavior                           |
| ------------------------ | ---------------------------------- |
| Post not found           | Skip record, log error, continue   |
| Parent comment not found | Continue without parent info       |
| Lambda invocation fails  | Log error, continue                |
| Unmarshall fails         | Log error, continue to next record |

Errors are isolated per record - one failure doesn't stop processing.

## Known Issues

1. **No Package.json**: Directory missing `package.json`, deployment may require manual setup
2. **Inefficient Parent Lookup**: Queries all comments on post to find one parent
3. **Hardcoded URL**: `txt-me.club` hardcoded, not configurable
4. **Missing Stream Config**: DynamoDB Streams not configured in Terraform
5. **Duplicate Notifications**: If post author is also mentioned, may get duplicate emails

## Infrastructure Requirements

DynamoDB Streams must be enabled on CMS-Comments table:

```hcl
stream_enabled   = true
stream_view_type = "NEW_IMAGE"
```

Lambda trigger must be configured to invoke this handler on stream events.

## Related Functions

| Function               | Relationship                              |
| ---------------------- | ----------------------------------------- |
| NotificationsSendEmail | Called to send actual emails              |
| CommentCreate          | Creates comments that trigger this stream |
