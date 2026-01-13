/**
 * Comments integration tests
 *
 * Tests CommentCreate, CommentsList, CommentDelete against DynamoDB Local
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
// Import handlers
import { handler as createHandler } from "../../../comments/CommentCreate/index.mjs";
import { handler as deleteHandler } from "../../../comments/CommentDelete/index.mjs";
import { handler as listHandler } from "../../../comments/CommentsList/index.mjs";
import type { CommentSchema } from "../contracts/schemas";
import { buildAuthEvent, buildEvent, docClient, parseBody, TABLES, uniqueId } from "../setup";

// Test user for comments tests
const commentTestUser = {
  userId: `comments-test-${uniqueId("user")}`,
  username: `commenter-${uniqueId("user")}`,
  role: "user",
};

// Test post for comments
const testPostId = `test-post-${uniqueId("post")}`;

// Track created comments for cleanup
const createdCommentIds: string[] = [];

describe("Comments", () => {
  beforeAll(async () => {
    // Create test user
    const passwordHash = await bcrypt.hash("password123", 10);
    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: {
          userId: commentTestUser.userId,
          username: commentTestUser.username,
          passwordHash,
          role: commentTestUser.role,
          createdAt: Date.now(),
        },
      }),
    );

    // Create test post
    await docClient.send(
      new PutCommand({
        TableName: TABLES.POSTS,
        Item: {
          postId: testPostId,
          userId: commentTestUser.userId,
          username: commentTestUser.username,
          title: "Test Post for Comments",
          content: "Post content",
          commentCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      }),
    );
  });

  afterAll(async () => {
    // Cleanup test user
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.USERS,
        Key: { userId: commentTestUser.userId },
      }),
    );

    // Cleanup test post
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.POSTS,
        Key: { postId: testPostId },
      }),
    );

    // Cleanup created comments
    for (const commentId of createdCommentIds) {
      try {
        await docClient.send(
          new DeleteCommand({
            TableName: TABLES.COMMENTS,
            Key: { commentId },
          }),
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("CommentCreate", () => {
    test("creates comment on post", async () => {
      const event = buildAuthEvent(commentTestUser, {
        method: "POST",
        body: {
          content: "This is a test comment!",
        },
        pathParameters: { id: testPostId },
      });

      const response = await createHandler(event);

      expect(response.statusCode).toBe(201);

      const body = parseBody<{ message: string; comment: typeof CommentSchema._type }>(response);
      expect(body.message).toBe("Comment created successfully");
      expect(body.comment.content).toBe("This is a test comment!");
      expect(body.comment.postId).toBe(testPostId);
      expect(body.comment.userId).toBe(commentTestUser.userId);
      expect(body.comment.username).toBe(commentTestUser.username);

      createdCommentIds.push(body.comment.commentId);
    });

    test("increments post commentCount", async () => {
      // Get initial comment count
      const initialPost = await docClient.send(
        new GetCommand({
          TableName: TABLES.POSTS,
          Key: { postId: testPostId },
        }),
      );
      const initialCount = initialPost.Item?.commentCount || 0;

      // Create comment
      const event = buildAuthEvent(commentTestUser, {
        method: "POST",
        body: {
          content: "Another comment to test count",
        },
        pathParameters: { id: testPostId },
      });

      const response = await createHandler(event);
      expect(response.statusCode).toBe(201);

      const body = parseBody<{ comment: { commentId: string } }>(response);
      createdCommentIds.push(body.comment.commentId);

      // Check comment count increased
      const updatedPost = await docClient.send(
        new GetCommand({
          TableName: TABLES.POSTS,
          Key: { postId: testPostId },
        }),
      );
      expect(updatedPost.Item?.commentCount).toBe(initialCount + 1);
    });

    test("creates nested comment with parentCommentId", async () => {
      // First create a parent comment
      const parentEvent = buildAuthEvent(commentTestUser, {
        method: "POST",
        body: {
          content: "Parent comment",
        },
        pathParameters: { id: testPostId },
      });

      const parentResponse = await createHandler(parentEvent);
      const parentBody = parseBody<{ comment: { commentId: string } }>(parentResponse);
      const parentCommentId = parentBody.comment.commentId;
      createdCommentIds.push(parentCommentId);

      // Create reply
      const replyEvent = buildAuthEvent(commentTestUser, {
        method: "POST",
        body: {
          content: "Reply to parent",
          parentCommentId,
        },
        pathParameters: { id: testPostId },
      });

      const replyResponse = await createHandler(replyEvent);

      expect(replyResponse.statusCode).toBe(201);

      const replyBody = parseBody<{ comment: typeof CommentSchema._type }>(replyResponse);
      expect(replyBody.comment.parentCommentId).toBe(parentCommentId);

      createdCommentIds.push(replyBody.comment.commentId);
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "POST",
        body: {
          content: "Comment without auth",
        },
        pathParameters: { id: testPostId },
      });

      const response = await createHandler(event);

      expect(response.statusCode).toBe(401);
    });

    test("returns 400 when content missing", async () => {
      const event = buildAuthEvent(commentTestUser, {
        method: "POST",
        body: {},
        pathParameters: { id: testPostId },
      });

      const response = await createHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Content is required");
    });
  });

  describe("CommentsList", () => {
    const listTestPostId = `list-test-post-${uniqueId("post")}`;
    const listCommentIds: string[] = [];

    beforeAll(async () => {
      // Create test post for listing
      await docClient.send(
        new PutCommand({
          TableName: TABLES.POSTS,
          Item: {
            postId: listTestPostId,
            userId: commentTestUser.userId,
            username: commentTestUser.username,
            title: "Post for Comment Listing",
            content: "Content",
            commentCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        }),
      );

      // Create multiple comments
      for (let i = 0; i < 3; i++) {
        const event = buildAuthEvent(commentTestUser, {
          method: "POST",
          body: {
            content: `Test comment ${i + 1}`,
          },
          pathParameters: { id: listTestPostId },
        });

        const response = await createHandler(event);
        const body = parseBody<{ comment: { commentId: string } }>(response);
        listCommentIds.push(body.comment.commentId);
      }
    });

    afterAll(async () => {
      // Cleanup
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.POSTS,
          Key: { postId: listTestPostId },
        }),
      );

      for (const commentId of listCommentIds) {
        await docClient.send(
          new DeleteCommand({
            TableName: TABLES.COMMENTS,
            Key: { commentId },
          }),
        );
      }
    });

    test("lists comments for a post", async () => {
      const event = buildEvent({
        method: "GET",
        pathParameters: { id: listTestPostId },
      });

      const response = await listHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ comments: (typeof CommentSchema._type)[]; count: number }>(response);
      expect(body.comments.length).toBeGreaterThanOrEqual(3);
      expect(body.count).toBeGreaterThanOrEqual(3);

      // Verify all comments belong to the post
      for (const comment of body.comments) {
        expect(comment.postId).toBe(listTestPostId);
      }
    });

    test("returns empty array for post with no comments", async () => {
      const event = buildEvent({
        method: "GET",
        pathParameters: { id: "post-with-no-comments" },
      });

      const response = await listHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ comments: unknown[]; count: number }>(response);
      expect(body.comments).toEqual([]);
      expect(body.count).toBe(0);
    });

    test("returns 400 when post ID missing", async () => {
      const event = buildEvent({
        method: "GET",
        pathParameters: {},
      });

      const response = await listHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Post ID is required");
    });

    test("supports pagination with limit", async () => {
      const event = buildEvent({
        method: "GET",
        pathParameters: { id: listTestPostId },
        queryStringParameters: { limit: "2" },
      });

      const response = await listHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ comments: unknown[]; count: number }>(response);
      expect(body.comments.length).toBeLessThanOrEqual(2);
    });
  });

  describe("CommentDelete", () => {
    test("deletes own comment", async () => {
      // Create a comment to delete
      const createEvent = buildAuthEvent(commentTestUser, {
        method: "POST",
        body: {
          content: "Comment to delete",
        },
        pathParameters: { id: testPostId },
      });

      const createResponse = await createHandler(createEvent);
      const createBody = parseBody<{ comment: { commentId: string } }>(createResponse);
      const commentId = createBody.comment.commentId;

      // Delete it
      const deleteEvent = buildAuthEvent(commentTestUser, {
        method: "DELETE",
        pathParameters: { commentId },
      });

      const response = await deleteHandler(deleteEvent);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ message: string }>(response);
      expect(body.message).toBe("Comment deleted successfully");

      // Verify it's deleted
      const getResult = await docClient.send(
        new GetCommand({
          TableName: TABLES.COMMENTS,
          Key: { commentId },
        }),
      );
      expect(getResult.Item).toBeUndefined();
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "DELETE",
        pathParameters: { commentId: "some-comment-id" },
      });

      const response = await deleteHandler(event);

      expect(response.statusCode).toBe(401);
    });

    test("returns 404 for non-existent comment", async () => {
      const event = buildAuthEvent(commentTestUser, {
        method: "DELETE",
        pathParameters: { commentId: "non-existent-comment-id" },
      });

      const response = await deleteHandler(event);

      expect(response.statusCode).toBe(404);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Comment not found");
    });

    test("returns 403 when deleting another user comment", async () => {
      // Create a comment
      const createEvent = buildAuthEvent(commentTestUser, {
        method: "POST",
        body: {
          content: "Protected comment",
        },
        pathParameters: { id: testPostId },
      });

      const createResponse = await createHandler(createEvent);
      const createBody = parseBody<{ comment: { commentId: string } }>(createResponse);
      const commentId = createBody.comment.commentId;
      createdCommentIds.push(commentId);

      // Try to delete as different user
      const otherUser = {
        userId: "other-user-id",
        username: "otheruser",
        role: "user",
      };

      const deleteEvent = buildAuthEvent(otherUser, {
        method: "DELETE",
        pathParameters: { commentId },
      });

      const response = await deleteHandler(deleteEvent);

      expect(response.statusCode).toBe(403);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Forbidden: You can only delete your own comments");
    });
  });
});
