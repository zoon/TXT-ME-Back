/**
 * Bun test preload - configures environment for DynamoDB Local
 *
 * AWS SDK v3 respects AWS_ENDPOINT_URL_DYNAMODB since v3.451.0
 */

// Set environment before any handler imports
process.env.AWS_REGION = "eu-north-1";
process.env.AWS_ACCESS_KEY_ID = "fakeKey";
process.env.AWS_SECRET_ACCESS_KEY = "fakeSecret";
process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://127.0.0.1:8000";
// Use the most common fallback secret used by handlers
process.env.JWT_SECRET = "cms-jwt-secret-prod-2025";

console.log("[test:preload] Environment configured for DynamoDB Local");
