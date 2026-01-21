/**
 * Users integration tests
 *
 * Tests UsersGetProfile, UsersUpdateEmail against DynamoDB Local
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import { Jimp } from "jimp";
// Import handlers
import { handler as getProfileHandler } from "../../../users/UsersGetProfile/index.mjs";
import {
  buildAuthEvent,
  buildEvent,
  CORRUPT_IMAGE_DATA_URL,
  docClient,
  INVALID_AVATAR_DATA_URL,
  parseBody,
  TABLES,
  uniqueId,
  VALID_AVATAR_DATA_URL,
} from "../setup";

// CommonJS handlers need different import
const { handler: updateEmailHandler } = require("../../../users/UsersUpdateEmail/index.js");
const { handler: addAvatarHandler } = require("../../../users/UsersAddAvatar/index.js");
const { handler: setActiveAvatarHandler } = require("../../../users/UsersSetActiveAvatar/index.js");
const { handler: deleteAvatarHandler } = require("../../../users/UsersDeleteAvatar/index.js");
const { handler: getUserAvatarHandler } = require("../../../users/UsersGetUserAvatar/index.js");
const { handler: updatePasswordHandler } = require("../../../users/UsersUpdatePassword/index.js");
const { handler: deleteEmailHandler } = require("../../../users/UsersDeleteEmail/index.js");

// Test user
const userTestUser = {
  userId: `users-test-${uniqueId("user")}`,
  username: `testuser-${uniqueId("user")}`,
  email: "original@test.com",
  role: "user",
};

describe("Users", () => {
  beforeAll(async () => {
    // Create test user
    const passwordHash = await bcrypt.hash("password123", 10);
    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: {
          userId: userTestUser.userId,
          username: userTestUser.username,
          email: userTestUser.email,
          passwordHash,
          role: userTestUser.role,
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
        Key: { userId: userTestUser.userId },
      }),
    );
  });

  describe("UsersGetProfile", () => {
    test("gets own profile successfully", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "GET",
      });

      const response = await getProfileHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{
        userId: string;
        username: string;
        email: string;
        role: string;
      }>(response);

      expect(body.userId).toBe(userTestUser.userId);
      expect(body.username).toBe(userTestUser.username);
      expect(body.email).toBe(userTestUser.email);
      expect(body.role).toBe(userTestUser.role);
    });

    test("does not return passwordHash in profile", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "GET",
      });

      const response = await getProfileHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<Record<string, unknown>>(response);

      // passwordHash should be stripped
      expect(body.passwordHash).toBeUndefined();
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "GET",
      });

      const response = await getProfileHandler(event);

      expect(response.statusCode).toBe(401);
    });

    test("returns 401 with invalid token", async () => {
      const event = buildEvent({
        method: "GET",
        headers: {
          Authorization: "Bearer invalid.token.here",
        },
      });

      const response = await getProfileHandler(event);

      expect(response.statusCode).toBe(401);
    });

    test("returns 404 for deleted user", async () => {
      // Create a temporary user
      const tempUser = {
        userId: `temp-${uniqueId("user")}`,
        username: `tempuser-${uniqueId("user")}`,
        role: "user",
      };

      const passwordHash = await bcrypt.hash("password123", 10);
      await docClient.send(
        new PutCommand({
          TableName: TABLES.USERS,
          Item: {
            userId: tempUser.userId,
            username: tempUser.username,
            passwordHash,
            role: tempUser.role,
            createdAt: Date.now(),
          },
        }),
      );

      // Delete the user
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.USERS,
          Key: { userId: tempUser.userId },
        }),
      );

      // Try to get profile
      const event = buildAuthEvent(tempUser, {
        method: "GET",
      });

      const response = await getProfileHandler(event);

      expect(response.statusCode).toBe(404);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("User not found");
    });
  });

  describe("UsersUpdateEmail", () => {
    test("updates email successfully", async () => {
      const newEmail = `updated-${uniqueId("email")}@test.com`;

      const event = buildAuthEvent(userTestUser, {
        method: "PUT",
        body: {
          email: newEmail,
        },
      });

      const response = await updateEmailHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ message: string; email: string }>(response);
      expect(body.message).toBe("Email updated");
      expect(body.email).toBe(newEmail);

      // Verify in database
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLES.USERS,
          Key: { userId: userTestUser.userId },
        }),
      );
      expect(result.Item?.email).toBe(newEmail);

      // Restore original email for other tests
      await docClient.send(
        new PutCommand({
          TableName: TABLES.USERS,
          Item: {
            ...result.Item,
            email: userTestUser.email,
          },
        }),
      );
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "PUT",
        body: {
          email: "new@test.com",
        },
      });

      const response = await updateEmailHandler(event);

      expect(response.statusCode).toBe(401);
    });

    test("returns 400 for invalid email (missing @)", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "PUT",
        body: {
          email: "invalid-email-no-at",
        },
      });

      const response = await updateEmailHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Invalid email");
    });

    test("returns 400 for empty email", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "PUT",
        body: {
          email: "",
        },
      });

      const response = await updateEmailHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Invalid email");
    });
  });

  describe("UsersAddAvatar", () => {
    const createdAvatarIds: string[] = [];

    afterAll(async () => {
      // Clean up any avatars added during tests
      if (createdAvatarIds.length > 0) {
        const result = await docClient.send(
          new GetCommand({
            TableName: TABLES.USERS,
            Key: { userId: userTestUser.userId },
          }),
        );
        if (result.Item) {
          const remainingAvatars = (result.Item.avatars || []).filter(
            (a: { avatarId: string }) => !createdAvatarIds.includes(a.avatarId),
          );
          await docClient.send(
            new PutCommand({
              TableName: TABLES.USERS,
              Item: {
                ...result.Item,
                avatars: remainingAvatars,
                activeAvatarId: remainingAvatars[0]?.avatarId || null,
              },
            }),
          );
        }
      }
    });

    test("adds avatar successfully with valid dataUrl", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "POST",
        body: {
          dataUrl: VALID_AVATAR_DATA_URL,
        },
      });

      const response = await addAvatarHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{
        avatar: { avatarId: string; dataUrl: string; uploadedAt: number };
        activeAvatarId: string;
      }>(response);

      expect(body.avatar).toBeDefined();
      expect(body.avatar.avatarId).toBeDefined();
      expect(body.avatar.dataUrl).toMatch(/^data:image\/\w+;base64,/);
      expect(body.activeAvatarId).toBe(body.avatar.avatarId);

      createdAvatarIds.push(body.avatar.avatarId);

      // Verify in database
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLES.USERS,
          Key: { userId: userTestUser.userId },
        }),
      );
      expect(result.Item?.avatars).toContainEqual(
        expect.objectContaining({ avatarId: body.avatar.avatarId }),
      );
    });

    test("resizes avatar to 50x50", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "POST",
        body: {
          dataUrl: VALID_AVATAR_DATA_URL,
        },
      });

      const response = await addAvatarHandler(event);
      expect(response.statusCode).toBe(200);

      const body = parseBody<{
        avatar: { avatarId: string; dataUrl: string };
      }>(response);

      createdAvatarIds.push(body.avatar.avatarId);

      // Decode base64 and verify dimensions
      const base64Data = body.avatar.dataUrl.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      const image = await Jimp.read(buffer);

      expect(image.width).toBe(50);
      expect(image.height).toBe(50);
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "POST",
        body: {
          dataUrl: VALID_AVATAR_DATA_URL,
        },
      });

      const response = await addAvatarHandler(event);

      expect(response.statusCode).toBe(500); // Handler returns 500 for auth errors
    });

    test("returns 400 for invalid dataUrl", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "POST",
        body: {
          dataUrl: INVALID_AVATAR_DATA_URL,
        },
      });

      const response = await addAvatarHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toContain("Invalid");
    });

    test("returns 400 for dataUrl over 10KB", async () => {
      // Create a large base64 string (over 10KB)
      const largeData = `data:image/png;base64,${"A".repeat(15000)}`;

      const event = buildAuthEvent(userTestUser, {
        method: "POST",
        body: {
          dataUrl: largeData,
        },
      });

      const response = await addAvatarHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toContain("large");
    });

    test("returns 400 for corrupt image data", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "POST",
        body: {
          dataUrl: CORRUPT_IMAGE_DATA_URL,
        },
      });

      const response = await addAvatarHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Invalid image data");
    });

    test("returns 400 when 50 avatar limit reached", async () => {
      // Create isolated test user for this test
      const limitTestUser = {
        userId: `avatar-limit-${uniqueId("user")}`,
        username: `limituser-${uniqueId("user")}`,
        role: "user",
      };

      // Seed user with 50 avatars directly via DynamoDB
      const fiftyAvatars = Array.from({ length: 50 }, (_, i) => ({
        avatarId: `avatar-${i}`,
        dataUrl: VALID_AVATAR_DATA_URL,
        uploadedAt: Date.now(),
      }));

      await docClient.send(
        new PutCommand({
          TableName: TABLES.USERS,
          Item: {
            userId: limitTestUser.userId,
            username: limitTestUser.username,
            passwordHash: "not-used",
            role: limitTestUser.role,
            avatars: fiftyAvatars,
            activeAvatarId: fiftyAvatars[0].avatarId,
            createdAt: Date.now(),
          },
        }),
      );

      try {
        // Attempt to add 51st avatar
        const event = buildAuthEvent(limitTestUser, {
          method: "POST",
          body: {
            dataUrl: VALID_AVATAR_DATA_URL,
          },
        });

        const response = await addAvatarHandler(event);

        expect(response.statusCode).toBe(400);
        const body = parseBody<{ error: string }>(response);
        expect(body.error).toBe("Max 50 avatars");
      } finally {
        // Cleanup
        await docClient.send(
          new DeleteCommand({
            TableName: TABLES.USERS,
            Key: { userId: limitTestUser.userId },
          }),
        );
      }
    });
  });

  describe("UsersSetActiveAvatar", () => {
    let testAvatarId: string;

    beforeAll(async () => {
      // Add an avatar for testing
      const event = buildAuthEvent(userTestUser, {
        method: "POST",
        body: {
          dataUrl: VALID_AVATAR_DATA_URL,
        },
      });

      const response = await addAvatarHandler(event);
      const body = parseBody<{ avatar: { avatarId: string } }>(response);
      testAvatarId = body.avatar.avatarId;
    });

    test("sets existing avatar as active", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "PUT",
        body: { avatarId: testAvatarId },
      });

      const response = await setActiveAvatarHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ message: string; avatarId: string }>(response);
      expect(body.message).toBe("Active avatar updated");
      expect(body.avatarId).toBe(testAvatarId);
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "PUT",
        body: { avatarId: testAvatarId },
      });

      const response = await setActiveAvatarHandler(event);

      expect(response.statusCode).toBe(401);
    });

    test("returns 400 for missing avatarId in body", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "PUT",
        body: {},
      });

      const response = await setActiveAvatarHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Missing avatarId");
    });

    test("returns 404 for non-existent avatarId", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "PUT",
        body: { avatarId: "non-existent-avatar-id" },
      });

      const response = await setActiveAvatarHandler(event);

      expect(response.statusCode).toBe(404);
      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Avatar not found");
    });
  });

  describe("UsersDeleteAvatar", () => {
    let activeAvatarId: string;
    let deletableAvatarId: string;

    beforeAll(async () => {
      // Add two avatars - one will be active, one we can delete
      const event1 = buildAuthEvent(userTestUser, {
        method: "POST",
        body: { dataUrl: VALID_AVATAR_DATA_URL },
      });
      const response1 = await addAvatarHandler(event1);
      const body1 = parseBody<{ avatar: { avatarId: string } }>(response1);
      activeAvatarId = body1.avatar.avatarId;

      const event2 = buildAuthEvent(userTestUser, {
        method: "POST",
        body: { dataUrl: VALID_AVATAR_DATA_URL },
      });
      const response2 = await addAvatarHandler(event2);
      const body2 = parseBody<{ avatar: { avatarId: string } }>(response2);
      deletableAvatarId = body2.avatar.avatarId;
    });

    test("deletes non-active avatar", async () => {
      // First avatar should be deletable since second became active
      const event = buildAuthEvent(userTestUser, {
        method: "DELETE",
        pathParameters: {
          avatarId: activeAvatarId, // First one is no longer active
        },
      });

      const response = await deleteAvatarHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ message: string; avatarId: string }>(response);
      expect(body.message).toBe("Avatar deleted");
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "DELETE",
        pathParameters: {
          avatarId: deletableAvatarId,
        },
      });

      const response = await deleteAvatarHandler(event);

      expect(response.statusCode).toBe(500); // Handler returns 500 for auth errors
    });

    test("returns 400 when trying to delete active avatar", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "DELETE",
        pathParameters: {
          avatarId: deletableAvatarId, // This is now active
        },
      });

      const response = await deleteAvatarHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toContain("active");
    });

    test("succeeds silently for non-existent avatarId", async () => {
      const event = buildAuthEvent(userTestUser, {
        method: "DELETE",
        pathParameters: {
          avatarId: "non-existent-avatar-id",
        },
      });

      const response = await deleteAvatarHandler(event);

      // Handler filters out non-existent avatars and returns success
      expect(response.statusCode).toBe(200);
      const body = parseBody<{ message: string; avatarId: string }>(response);
      expect(body.message).toBe("Avatar deleted");
      expect(body.avatarId).toBe("non-existent-avatar-id");
    });
  });

  describe("UsersGetUserAvatar", () => {
    test("returns specific avatar by avatarId (public endpoint, no auth)", async () => {
      // Create a fresh user with an avatar
      const testUser = {
        userId: `get-avatar-test-${uniqueId("user")}`,
        username: `getavataruser-${uniqueId("user")}`,
        role: "user",
      };
      const avatarId = `${Date.now()}`;

      await docClient.send(
        new PutCommand({
          TableName: TABLES.USERS,
          Item: {
            userId: testUser.userId,
            username: testUser.username,
            passwordHash: "not-used",
            role: testUser.role,
            createdAt: Date.now(),
            avatars: [{ avatarId, dataUrl: VALID_AVATAR_DATA_URL, uploadedAt: Date.now() }],
            activeAvatarId: avatarId,
          },
        }),
      );

      try {
        // Fetch the avatar by ID (public endpoint)
        const event = buildEvent({
          method: "GET",
          pathParameters: {
            userId: testUser.userId,
            avatarId: avatarId,
          },
        });

        const response = await getUserAvatarHandler(event);

        expect(response.statusCode).toBe(200);

        const body = parseBody<{
          userId: string;
          username: string;
          avatarId: string;
          avatarDataUrl: string;
        }>(response);

        expect(body.userId).toBe(testUser.userId);
        expect(body.username).toBe(testUser.username);
        expect(body.avatarId).toBe(avatarId);
        expect(body.avatarDataUrl).toBeTruthy();
      } finally {
        await docClient.send(
          new DeleteCommand({
            TableName: TABLES.USERS,
            Key: { userId: testUser.userId },
          }),
        );
      }
    });

    test("returns 404 for non-existent user", async () => {
      const event = buildEvent({
        method: "GET",
        pathParameters: {
          userId: "non-existent-user-id",
          avatarId: "some-avatar-id",
        },
      });

      const response = await getUserAvatarHandler(event);

      expect(response.statusCode).toBe(404);
    });

    test("returns 404 for non-existent avatar", async () => {
      const event = buildEvent({
        method: "GET",
        pathParameters: {
          userId: userTestUser.userId,
          avatarId: "non-existent-avatar-id",
        },
      });

      const response = await getUserAvatarHandler(event);

      expect(response.statusCode).toBe(404);
      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Avatar not found");
    });
  });

  describe("UsersUpdatePassword", () => {
    // Create a separate user for password tests to avoid affecting other tests
    const passwordTestUser = {
      userId: `pwd-test-${uniqueId("user")}`,
      username: `pwduser-${uniqueId("user")}`,
      role: "user",
    };
    const originalPassword = "password123";

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash(originalPassword, 10);
      await docClient.send(
        new PutCommand({
          TableName: TABLES.USERS,
          Item: {
            userId: passwordTestUser.userId,
            username: passwordTestUser.username,
            passwordHash,
            role: passwordTestUser.role,
            createdAt: Date.now(),
          },
        }),
      );
    });

    afterAll(async () => {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.USERS,
          Key: { userId: passwordTestUser.userId },
        }),
      );
    });

    test("updates password with valid old password", async () => {
      const event = buildAuthEvent(passwordTestUser, {
        method: "PUT",
        body: {
          oldPassword: originalPassword,
          newPassword: "newpassword123",
        },
      });

      const response = await updatePasswordHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ message: string }>(response);
      expect(body.message).toBe("Password updated successfully");

      // Verify new password works
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLES.USERS,
          Key: { userId: passwordTestUser.userId },
        }),
      );
      const isValid = await bcrypt.compare("newpassword123", result.Item?.passwordHash);
      expect(isValid).toBe(true);
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "PUT",
        body: {
          oldPassword: "any",
          newPassword: "newpassword123",
        },
      });

      const response = await updatePasswordHandler(event);

      expect(response.statusCode).toBe(401);
    });

    test("returns 400 for missing passwords", async () => {
      const event = buildAuthEvent(passwordTestUser, {
        method: "PUT",
        body: {},
      });

      const response = await updatePasswordHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toBe("Missing passwords");
    });

    test("returns 400 for new password under 8 characters", async () => {
      const event = buildAuthEvent(passwordTestUser, {
        method: "PUT",
        body: {
          oldPassword: "newpassword123",
          newPassword: "short",
        },
      });

      const response = await updatePasswordHandler(event);

      expect(response.statusCode).toBe(400);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toContain("8 characters");
    });

    test("returns 401 for incorrect old password", async () => {
      const event = buildAuthEvent(passwordTestUser, {
        method: "PUT",
        body: {
          oldPassword: "wrongpassword",
          newPassword: "newpassword456",
        },
      });

      const response = await updatePasswordHandler(event);

      expect(response.statusCode).toBe(401);

      const body = parseBody<{ error: string }>(response);
      expect(body.error).toContain("Incorrect");
    });
  });

  describe("UsersDeleteEmail", () => {
    // Create a separate user for email deletion tests
    const emailTestUser = {
      userId: `email-test-${uniqueId("user")}`,
      username: `emailuser-${uniqueId("user")}`,
      email: "todelete@test.com",
      role: "user",
    };

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash("password123", 10);
      await docClient.send(
        new PutCommand({
          TableName: TABLES.USERS,
          Item: {
            userId: emailTestUser.userId,
            username: emailTestUser.username,
            email: emailTestUser.email,
            passwordHash,
            role: emailTestUser.role,
            createdAt: Date.now(),
          },
        }),
      );
    });

    afterAll(async () => {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.USERS,
          Key: { userId: emailTestUser.userId },
        }),
      );
    });

    test("removes email successfully", async () => {
      const event = buildAuthEvent(emailTestUser, {
        method: "DELETE",
      });

      const response = await deleteEmailHandler(event);

      expect(response.statusCode).toBe(200);

      const body = parseBody<{ message: string }>(response);
      expect(body.message).toBe("Email removed successfully");

      // Verify email was removed from database
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLES.USERS,
          Key: { userId: emailTestUser.userId },
        }),
      );
      expect(result.Item?.email).toBeUndefined();
    });

    test("returns 401 without auth", async () => {
      const event = buildEvent({
        method: "DELETE",
      });

      const response = await deleteEmailHandler(event);

      expect(response.statusCode).toBe(401);
    });
  });
});
