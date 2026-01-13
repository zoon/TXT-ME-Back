/**
 * Auth integration tests
 *
 * Tests AuthRegister and AuthLogin against DynamoDB Local
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import { handler as loginHandler } from "../../../auth/AuthLogin/index.mjs";
// Import handlers
import { handler as registerHandler } from "../../../auth/AuthRegister/index.mjs";
import {
  AuthLoginSuccessSchema,
  AuthRegisterSuccessSchema,
  assertResponse,
} from "../contracts/schemas";
import { buildEvent, docClient, parseBody, TABLES, uniqueId } from "../setup";

describe("AuthRegister", () => {
  const testUsername = `testuser-${uniqueId("reg")}`;

  afterAll(async () => {
    // Cleanup test user
    try {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.USERS,
          Key: { userId: testUsername }, // This won't work - need to find by username first
        }),
      );
    } catch {
      // Ignore cleanup errors
    }
  });

  test("registers new user successfully", async () => {
    const username = `newuser-${uniqueId("reg")}`;
    const event = buildEvent({
      method: "POST",
      body: {
        username,
        password: "testpassword123",
      },
    });

    const response = await registerHandler(event);

    expect(response.statusCode).toBe(201);

    const body = assertResponse(response, 201, AuthRegisterSuccessSchema);
    expect(body.message).toBe("User registered successfully. Awaiting activation by admin.");
    expect(body.userId).toBeDefined();
  });

  test("returns 400 when username missing", async () => {
    const event = buildEvent({
      method: "POST",
      body: {
        password: "testpassword123",
      },
    });

    const response = await registerHandler(event);

    expect(response.statusCode).toBe(400);

    const body = parseBody<{ error: string }>(response);
    expect(body.error).toBe("Username and password are required");
  });

  test("returns 400 when password missing", async () => {
    const event = buildEvent({
      method: "POST",
      body: {
        username: "someuser",
      },
    });

    const response = await registerHandler(event);

    expect(response.statusCode).toBe(400);

    const body = parseBody<{ error: string }>(response);
    expect(body.error).toBe("Username and password are required");
  });

  test("returns 409 when username already exists", async () => {
    const username = `existing-${uniqueId("dup")}`;

    // First registration
    const event1 = buildEvent({
      method: "POST",
      body: { username, password: "password1" },
    });
    await registerHandler(event1);

    // Second registration with same username
    const event2 = buildEvent({
      method: "POST",
      body: { username, password: "password2" },
    });
    const response = await registerHandler(event2);

    expect(response.statusCode).toBe(409);

    const body = parseBody<{ error: string }>(response);
    expect(body.error).toBe("Username already exists");
  });
});

describe("AuthLogin", () => {
  const testUser = {
    userId: `login-test-${uniqueId("user")}`,
    username: `loginuser-${uniqueId("login")}`,
    password: "correctpassword",
    role: "user",
  };

  beforeAll(async () => {
    // Create test user with hashed password
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: {
          userId: testUser.userId,
          username: testUser.username,
          passwordHash,
          role: testUser.role,
          createdAt: Date.now(),
        },
      }),
    );
  });

  afterAll(async () => {
    // Cleanup
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.USERS,
        Key: { userId: testUser.userId },
      }),
    );
  });

  test("logs in successfully with valid credentials", async () => {
    const event = buildEvent({
      method: "POST",
      body: {
        username: testUser.username,
        password: testUser.password,
      },
    });

    const response = await loginHandler(event);

    expect(response.statusCode).toBe(200);

    const body = assertResponse(response, 200, AuthLoginSuccessSchema);
    expect(body.message).toBe("Login successful");
    expect(body.token).toBeDefined();
    expect(body.user.username).toBe(testUser.username);
    expect(body.user.role).toBe("user");
  });

  test("returns 400 when credentials missing", async () => {
    const event = buildEvent({
      method: "POST",
      body: {},
    });

    const response = await loginHandler(event);

    expect(response.statusCode).toBe(400);

    const body = parseBody<{ error: string }>(response);
    expect(body.error).toBe("Username and password are required");
  });

  test("returns 401 for invalid password", async () => {
    const event = buildEvent({
      method: "POST",
      body: {
        username: testUser.username,
        password: "wrongpassword",
      },
    });

    const response = await loginHandler(event);

    expect(response.statusCode).toBe(401);

    const body = parseBody<{ error: string }>(response);
    expect(body.error).toBe("Invalid credentials");
  });

  test("returns 401 for non-existent user", async () => {
    const event = buildEvent({
      method: "POST",
      body: {
        username: "nonexistent-user-xyz",
        password: "anypassword",
      },
    });

    const response = await loginHandler(event);

    expect(response.statusCode).toBe(401);

    const body = parseBody<{ error: string }>(response);
    expect(body.error).toBe("Invalid credentials");
  });

  test("returns 403 for user without role (not activated)", async () => {
    // Create inactive user (no role)
    const inactiveUser = {
      userId: `inactive-${uniqueId("user")}`,
      username: `inactive-${uniqueId("login")}`,
      password: "password123",
    };

    const passwordHash = await bcrypt.hash(inactiveUser.password, 10);
    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: {
          userId: inactiveUser.userId,
          username: inactiveUser.username,
          passwordHash,
          createdAt: Date.now(),
          // No role - user is inactive
        },
      }),
    );

    const event = buildEvent({
      method: "POST",
      body: {
        username: inactiveUser.username,
        password: inactiveUser.password,
      },
    });

    const response = await loginHandler(event);

    expect(response.statusCode).toBe(403);

    const body = parseBody<{ error: string }>(response);
    expect(body.error).toBe("User account not activated. Contact administrator.");

    // Cleanup
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.USERS,
        Key: { userId: inactiveUser.userId },
      }),
    );
  });
});
