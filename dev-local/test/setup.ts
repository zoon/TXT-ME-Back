/**
 * Test harness setup for TXT-ME Backend integration tests
 *
 * Provides:
 * - DynamoDB Local client
 * - JWT token generation
 * - Shared seed data
 * - Lambda event builders
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

// Use the most common fallback secret used by handlers
export const JWT_SECRET = "cms-jwt-secret-prod-2025";
process.env.JWT_SECRET = JWT_SECRET;

// DynamoDB Local client
const client = new DynamoDBClient({
  region: "eu-north-1",
  endpoint: "http://127.0.0.1:8000",
  credentials: {
    accessKeyId: "fakeKey",
    secretAccessKey: "fakeSecret",
  },
});

export const docClient = DynamoDBDocumentClient.from(client);

// Table names
export const TABLES = {
  USERS: "CMS-Users",
  POSTS: "CMS-Posts",
  COMMENTS: "CMS-Comments",
  TAGS: "CMS-Tags",
} as const;

// Shared test fixtures - seeded once
export const testUsers = {
  alice: {
    userId: "test-user-alice-001",
    username: "alice",
    email: "alice@test.com",
    password: "$2b$10$hashedpassword", // bcrypt hash of 'password123'
    role: "user",
    createdAt: new Date().toISOString(),
  },
  bob: {
    userId: "test-user-bob-002",
    username: "bob",
    email: "bob@test.com",
    password: "$2b$10$hashedpassword",
    role: "user",
    createdAt: new Date().toISOString(),
  },
  admin: {
    userId: "test-user-admin-003",
    username: "admin",
    email: "admin@test.com",
    password: "$2b$10$hashedpassword",
    role: "admin",
    createdAt: new Date().toISOString(),
  },
};

export const testPosts = {
  alicePost: {
    postId: "test-post-alice-001",
    userId: testUsers.alice.userId,
    username: testUsers.alice.username,
    title: "Alice First Post",
    content: "This is Alice test post content",
    status: "published",
    commentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

export const testComments = {
  bobOnAlice: {
    commentId: "test-comment-bob-001",
    postId: testPosts.alicePost.postId,
    userId: testUsers.bob.userId,
    username: testUsers.bob.username,
    content: "Great post Alice!",
    createdAt: new Date().toISOString(),
  },
};

// Valid 1x1 transparent PNG for avatar tests (under 10KB)
export const VALID_AVATAR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Invalid data URL for testing validation
export const INVALID_AVATAR_DATA_URL = "not-a-valid-data-url";

/**
 * Generate JWT token for a test user
 */
export function generateToken(user: { userId: string; username: string; role?: string }): string {
  return jwt.sign(
    {
      userId: user.userId,
      sub: user.userId,
      username: user.username,
      role: user.role || "user",
    },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

/**
 * Build Lambda event object
 */
export function buildEvent(options: {
  method?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
}) {
  return {
    httpMethod: options.method || "POST",
    body: options.body ? JSON.stringify(options.body) : null,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    pathParameters: options.pathParameters || null,
    queryStringParameters: options.queryStringParameters || null,
  };
}

/**
 * Build authenticated event with Bearer token
 */
export function buildAuthEvent(
  user: { userId: string; username: string; role?: string },
  options: Omit<Parameters<typeof buildEvent>[0], "headers"> & { headers?: Record<string, string> },
) {
  const token = generateToken(user);
  return buildEvent({
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

/**
 * Seed shared test data into DynamoDB Local
 */
export async function seedTestData() {
  // Seed users
  for (const user of Object.values(testUsers)) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: user,
      }),
    );
  }

  // Seed posts
  for (const post of Object.values(testPosts)) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.POSTS,
        Item: post,
      }),
    );
  }

  // Seed comments
  for (const comment of Object.values(testComments)) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.COMMENTS,
        Item: comment,
      }),
    );
  }
}

/**
 * Clean up all test data from tables
 */
export async function cleanupTestData() {
  for (const tableName of Object.values(TABLES)) {
    const { Items } = await docClient.send(
      new ScanCommand({
        TableName: tableName,
      }),
    );

    if (Items) {
      for (const item of Items) {
        const key = getTableKey(tableName, item);
        if (key) {
          await docClient.send(
            new DeleteCommand({
              TableName: tableName,
              Key: key,
            }),
          );
        }
      }
    }
  }
}

function getTableKey(
  tableName: string,
  item: Record<string, unknown>,
): Record<string, unknown> | null {
  switch (tableName) {
    case TABLES.USERS:
      return { userId: item.userId };
    case TABLES.POSTS:
      return { postId: item.postId };
    case TABLES.COMMENTS:
      return { commentId: item.commentId };
    case TABLES.TAGS:
      return { tagId: item.tagId };
    default:
      return null;
  }
}

/**
 * Generate unique ID with prefix for test isolation
 */
export function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse Lambda response body
 */
export function parseBody<T = unknown>(response: { body: string }): T {
  return JSON.parse(response.body) as T;
}
