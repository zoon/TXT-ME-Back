/**
 * Posts integration tests
 *
 * Tests PostCreate, PostsGet, PostDelete against DynamoDB Local
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
// Import handlers
import { handler as createHandler } from "../../../posts/PostCreate/index.mjs";
import { handler as deleteHandler } from "../../../posts/PostDelete/index.mjs";
import { handler as getHandler } from "../../../posts/PostsGet/index.mjs";
import type { PostSchema } from "../contracts/schemas";
import { buildAuthEvent, buildEvent, docClient, parseBody, TABLES, uniqueId } from "../setup";

// Test user for posts tests
const postTestUser = {
  userId: `posts-test-${uniqueId("user")}`,
  username: `poster-${uniqueId("user")}`,
  role: "user",
};

// Track created posts for cleanup
const createdPostIds: string[] = [];

describe("Posts", () => {
  beforeAll(async () => {
    // Create test user
    const passwordHash = await bcrypt.hash("password123", 10);
    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: {
          userId: postTestUser.userId,
          username: postTestUser.username,
          passwordHash,
          role: postTestUser.role,
          createdAt: Date.now(),
        },
      }),
    );
  });

  afterAll(async () => {
    // Cleanup test user
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.USERS,
        Key: { userId: postTestUser.userId },
      }),
    );

    // Cleanup created posts
    for (const postId of createdPostIds) {
      try {
        await docClient.send(
          new DeleteCommand({
            TableName: TABLES.POSTS,
            Key: { postId },
          }),
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("PostCreate", () => {
    test("creates post with valid auth", async () => {
      const event = buildAuthEvent(postTestUser, {
        method: "POST",
        body: {
          title: "Test Post Title",
          content: "This is the test post content.",
          tags: [],
        },
      });

      const response = await createHandler(event);

      expect(response.statusCode).toBe(201);

      const body = parseBody<{ message: string; post: typeof PostSchema._type }>(response);
      expect(body.message).toBe("Post created successfully");
      expect(body.post.title).toBe("Test Post Title");
      expect(body.post.content).toBe("This is the test post content.");
      expect(body.post.userId).toBe(postTestUser.userId);
      expect(body.post.username).toBe(postTestUser.username);
      expect(body.post.commentCount).toBe(0);

      // Track for cleanup
      createdPostIds.push(body.post.postId);
    });

    test("returns 401 without auth token", async () => {
      const event = buildEvent({
        method: "POST",
        body: {
          title: "Test Post",
          content: "Content",
        },
      });

      const response = await createHandler(event);

      expect(response.statusCode).toBe(401);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Unauthorized: No token provided");
    });

    test("returns 401 with invalid token", async () => {
      const event = buildEvent({
        method: "POST",
        body: {
          title: "Test Post",
          content: "Content",
        },
        headers: {
          Authorization: "Bearer invalid.token.here",
        },
      });

      const response = await createHandler(event);

      expect(response.statusCode).toBe(401);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Unauthorized: Invalid token");
    });

    test("returns 400 when title missing", async () => {
      const event = buildAuthEvent(postTestUser, {
        method: "POST",
        body: {
          content: "Content without title",
        },
      });

      const response = await createHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Title and content are required");
    });

    test("returns 400 when content missing", async () => {
      const event = buildAuthEvent(postTestUser, {
        method: "POST",
        body: {
          title: "Title without content",
        },
      });

      const response = await createHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Title and content are required");
    });

    test("creates post with tags", async () => {
      const event = buildAuthEvent(postTestUser, {
        method: "POST",
        body: {
          title: "Tagged Post",
          content: "Post with tags",
          tags: ["tag1", "tag2"],
        },
      });

      const response = await createHandler(event);

      expect(response.statusCode).toBe(201);

      const body = parseBody<{ message: string; post: typeof PostSchema._type }>(response);
      expect(body.post.tags).toEqual(["tag1", "tag2"]);

      createdPostIds.push(body.post.postId);
    });
  });

  describe("PostsGet", () => {
    let existingPostId: string;

    beforeAll(async () => {
      // Create a post to get
      const event = buildAuthEvent(postTestUser, {
        method: "POST",
        body: {
          title: "Post to Get",
          content: "Content for get test",
        },
      });

      const response = await createHandler(event);
      const body = parseBody<{ post: { postId: string } }>(response);
      existingPostId = body.post.postId;
      createdPostIds.push(existingPostId);
    });

    test("gets existing post by ID", async () => {
      const event = buildEvent({
        method: "GET",
        pathParameters: { id: existingPostId },
      });

      const response = await getHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ post: typeof PostSchema._type }>(response);
      expect(body.post.postId).toBe(existingPostId);
      expect(body.post.title).toBe("Post to Get");
    });

    test("returns 404 for non-existent post", async () => {
      const event = buildEvent({
        method: "GET",
        pathParameters: { id: "non-existent-post-id" },
      });

      const response = await getHandler(event);

      expect(response.statusCode).toBe(404);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Post not found");
    });

    test("returns 400 when post ID missing", async () => {
      const event = buildEvent({
        method: "GET",
        pathParameters: {},
      });

      const response = await getHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Post ID is required");
    });
  });

  describe("PostDelete", () => {
    test("deletes own post", async () => {
      // Create a post to delete
      const createEvent = buildAuthEvent(postTestUser, {
        method: "POST",
        body: {
          title: "Post to Delete",
          content: "This post will be deleted",
        },
      });

      const createResponse = await createHandler(createEvent);
      const createBody = parseBody<{ post: { postId: string } }>(createResponse);
      const postId = createBody.post.postId;

      // Delete it
      const deleteEvent = buildAuthEvent(postTestUser, {
        method: "DELETE",
        pathParameters: { id: postId },
      });

      const response = await deleteHandler(deleteEvent);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ message: string; postId: string }>(response);
      expect(body.message).toBe("Post and associated comments deleted successfully");
      expect(body.postId).toBe(postId);

      // Verify it's actually deleted
      const getResult = await docClient.send(
        new GetCommand({
          TableName: TABLES.POSTS,
          Key: { postId },
        }),
      );
      expect(getResult.Item).toBeUndefined();
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "DELETE",
        pathParameters: { id: "some-post-id" },
      });

      const response = await deleteHandler(event);

      expect(response.statusCode).toBe(401);
    });

    test("returns 404 for non-existent post", async () => {
      const event = buildAuthEvent(postTestUser, {
        method: "DELETE",
        pathParameters: { id: "non-existent-post-id" },
      });

      const response = await deleteHandler(event);

      expect(response.statusCode).toBe(404);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Post not found");
    });

    test("returns 403 when deleting another user post", async () => {
      // Create a post as postTestUser
      const createEvent = buildAuthEvent(postTestUser, {
        method: "POST",
        body: {
          title: "Protected Post",
          content: "This post belongs to another user",
        },
      });

      const createResponse = await createHandler(createEvent);
      const createBody = parseBody<{ post: { postId: string } }>(createResponse);
      const postId = createBody.post.postId;
      createdPostIds.push(postId);

      // Try to delete as different user
      const otherUser = {
        userId: "other-user-id",
        username: "otheruser",
        role: "user",
      };

      const deleteEvent = buildAuthEvent(otherUser, {
        method: "DELETE",
        pathParameters: { id: postId },
      });

      const response = await deleteHandler(deleteEvent);

      expect(response.statusCode).toBe(403);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Forbidden: You can only delete your own posts");
    });
  });
});
