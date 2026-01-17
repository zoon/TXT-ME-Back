#!/usr/bin/env node
/**
 * Activate users in local DynamoDB
 *
 * Usage:
 *   bun run activate              # List all users and their status
 *   bun run activate <username>   # Activate specific user as 'user'
 *   bun run activate <username> admin  # Activate as 'admin'
 *   bun run activate --all        # Activate all pending users
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "eu-north-1",
  endpoint: "http://127.0.0.1:8000",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});
const docClient = DynamoDBDocumentClient.from(client);

async function getAllUsers() {
  const result = await docClient.send(new ScanCommand({ TableName: "CMS-Users" }));
  return result.Items || [];
}

async function activateUser(userId, role) {
  await docClient.send(
    new UpdateCommand({
      TableName: "CMS-Users",
      Key: { userId },
      UpdateExpression: "SET #role = :r",
      ExpressionAttributeNames: { "#role": "role" },
      ExpressionAttributeValues: { ":r": role },
    }),
  );
}

async function main() {
  const args = process.argv.slice(2);
  const users = await getAllUsers();

  if (users.length === 0) {
    console.log("No users found. Register one first.");
    process.exit(0);
  }

  // No args: list all users
  if (args.length === 0) {
    console.log("\nUsers in local DB:\n");
    console.log("  USERNAME            ROLE        STATUS");
    console.log(`  ${"-".repeat(50)}`);
    for (const u of users) {
      const status = u.role ? "✓ active" : "⏳ pending";
      const role = u.role || "-";
      console.log(`  ${u.username.padEnd(18)} ${role.padEnd(10)} ${status}`);
    }
    console.log("\nTo activate: bun run activate <username> [admin]");
    console.log("To activate all: bun run activate --all\n");
    process.exit(0);
  }

  // --all: activate all pending
  if (args[0] === "--all") {
    const pending = users.filter((u) => !u.role);
    if (pending.length === 0) {
      console.log("All users already activated.");
      process.exit(0);
    }
    for (const u of pending) {
      await activateUser(u.userId, "user");
      console.log(`✓ Activated: ${u.username}`);
    }
    process.exit(0);
  }

  // Specific user
  const username = args[0];
  const role = args[1] || "user";

  if (!["user", "admin"].includes(role)) {
    console.error(`Invalid role: ${role}. Use 'user' or 'admin'.`);
    process.exit(1);
  }

  const user = users.find((u) => u.username === username);
  if (!user) {
    console.error(`User not found: ${username}`);
    console.log("Available users:", users.map((u) => u.username).join(", "));
    process.exit(1);
  }

  await activateUser(user.userId, role);
  console.log(`✓ ${username} activated as ${role}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
