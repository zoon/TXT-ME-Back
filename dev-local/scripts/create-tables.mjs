import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  region: "eu-north-1",
  endpoint: "http://127.0.0.1:8000",
  credentials: { accessKeyId: "fakeKey", secretAccessKey: "fakeSecret" }
});

const tables = [
  {
    TableName: "CMS-Users",
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "username", AttributeType: "S" }
    ],
    GlobalSecondaryIndexes: [{
      IndexName: "UsernameIndex",
      KeySchema: [{ AttributeName: "username", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" }
    }],
    BillingMode: "PAY_PER_REQUEST"
  },
  {
    TableName: "CMS-Posts",
    KeySchema: [{ AttributeName: "postId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "postId", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "N" }
    ],
    GlobalSecondaryIndexes: [
      { IndexName: "userId-index", KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }], Projection: { ProjectionType: "ALL" } },
      { IndexName: "createdAt-index", KeySchema: [{ AttributeName: "createdAt", KeyType: "HASH" }], Projection: { ProjectionType: "ALL" } }
    ],
    BillingMode: "PAY_PER_REQUEST"
  },
  {
    TableName: "CMS-Comments",
    KeySchema: [{ AttributeName: "commentId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "commentId", AttributeType: "S" },
      { AttributeName: "postId", AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "N" }
    ],
    GlobalSecondaryIndexes: [{
      IndexName: "postId-index",
      KeySchema: [
        { AttributeName: "postId", KeyType: "HASH" },
        { AttributeName: "createdAt", KeyType: "RANGE" }
      ],
      Projection: { ProjectionType: "ALL" }
    }],
    BillingMode: "PAY_PER_REQUEST"
  },
  {
    TableName: "CMS-Tags",
    KeySchema: [{ AttributeName: "tagId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "tagId", AttributeType: "S" },
      { AttributeName: "name", AttributeType: "S" }
    ],
    GlobalSecondaryIndexes: [{
      IndexName: "name-index",
      KeySchema: [{ AttributeName: "name", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" }
    }],
    BillingMode: "PAY_PER_REQUEST"
  }
];

async function createTables() {
  const existing = await client.send(new ListTablesCommand({}));
  console.log("Existing tables:", existing.TableNames);

  for (const table of tables) {
    if (existing.TableNames?.includes(table.TableName)) {
      console.log(`Table ${table.TableName} already exists, skipping`);
      continue;
    }
    try {
      await client.send(new CreateTableCommand(table));
      console.log(`Created table: ${table.TableName}`);
    } catch (err) {
      console.error(`Failed to create ${table.TableName}:`, err.message);
    }
  }

  const final = await client.send(new ListTablesCommand({}));
  console.log("Final tables:", final.TableNames);
}

createTables();
