/**
 * Auth integration tests
 *
 * Tests AuthRegister and AuthLogin against DynamoDB Local
 */

import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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

  test("saves email when provided during registration", async () => {
    const username = `emailtest-${uniqueId("reg")}`;
    const email = `${username}@test.com`;

    const event = buildEvent({
      method: "POST",
      body: { username, password: "testpassword123", email },
    });

    const response = await registerHandler(event);
    expect(response.statusCode).toBe(201);

    const body = parseBody<{ userId: string }>(response);

    // Verify email was actually saved to database
    const { Item } = await docClient.send(
      new GetCommand({
        TableName: TABLES.USERS,
        Key: { userId: body.userId },
      }),
    );

    expect(Item?.email).toBe(email);

    // Cleanup
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.USERS,
        Key: { userId: body.userId },
      }),
    );
  });

  /**
   * Regression test: Race condition in concurrent registrations
   *
   * The current implementation uses check-then-put which is not atomic.
   * Concurrent registrations with the same username could both succeed,
   * creating duplicate users. This test will FAIL until we add a
   * conditional put with attribute_not_exists().
   */
  test("prevents duplicate users under concurrent registration", async () => {
    const username = `racetest-${uniqueId("race")}`;
    const userIds: string[] = [];

    // Fire two concurrent registrations with the same username
    const event1 = buildEvent({
      method: "POST",
      body: { username, password: "password1" },
    });
    const event2 = buildEvent({
      method: "POST",
      body: { username, password: "password2" },
    });

    const [response1, response2] = await Promise.all([
      registerHandler(event1),
      registerHandler(event2),
    ]);

    // Collect userIds from successful registrations for cleanup
    if (response1.statusCode === 201) {
      userIds.push(parseBody<{ userId: string }>(response1).userId);
    }
    if (response2.statusCode === 201) {
      userIds.push(parseBody<{ userId: string }>(response2).userId);
    }

    // Verify: exactly one should succeed (201), one should fail (409)
    const statusCodes = [response1.statusCode, response2.statusCode].sort();
    expect(statusCodes).toEqual([201, 409]);

    // Double-check: query DB to ensure only one user exists with this username
    const { Items } = await docClient.send(
      new QueryCommand({
        TableName: TABLES.USERS,
        IndexName: "username-index",
        KeyConditionExpression: "username = :username",
        ExpressionAttributeValues: { ":username": username },
      }),
    );
    expect(Items?.length).toBe(1);

    // Cleanup all created users
    for (const userId of userIds) {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.USERS,
          Key: { userId },
        }),
      );
    }
  });

  /**
   * Regression test: PII (password) should not be logged
   *
   * The handler logs the entire event with console.log, which includes
   * the password in plaintext. This test verifies that passwords are
   * not exposed in logs.
   */
  test("does not log password in plaintext", async () => {
    const username = `logtest-${uniqueId("log")}`;
    const sensitivePassword = `secret-${uniqueId("pwd")}-sensitive`;
    const loggedMessages: string[] = [];

    // Spy on console.log to capture logged messages
    const consoleSpy = spyOn(console, "log").mockImplementation((...args) => {
      loggedMessages.push(args.map(String).join(" "));
    });

    const event = buildEvent({
      method: "POST",
      body: { username, password: sensitivePassword },
    });

    const response = await registerHandler(event);

    // Restore console.log
    consoleSpy.mockRestore();

    // Check that password was not logged
    const logOutput = loggedMessages.join("\n");
    expect(logOutput).not.toContain(sensitivePassword);

    // Cleanup if user was created
    if (response.statusCode === 201) {
      const body = parseBody<{ userId: string }>(response);
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.USERS,
          Key: { userId: body.userId },
        }),
      );
    }
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
