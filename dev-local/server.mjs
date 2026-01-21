/**
 * Local API server for frontend development
 * Routes HTTP requests to Lambda handlers against DynamoDB Local
 */

// Set environment before importing handlers
delete process.env.AWS_PROFILE; // Avoid credential source conflict
process.env.JWT_SECRET = "cms-jwt-secret-prod-2025";
process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://127.0.0.1:8000";
process.env.AWS_ACCESS_KEY_ID = "local";
process.env.AWS_SECRET_ACCESS_KEY = "local";
process.env.AWS_REGION = "eu-north-1";

const PORT = 3001;

// Route definitions: [method, pattern, handlerPath, pathParamNames]
const routes = [
  // Auth
  ["POST", "/auth/register", "../auth/AuthRegister/index.mjs", []],
  ["POST", "/auth/login", "../auth/AuthLogin/index.mjs", []],

  // Posts
  ["GET", "/posts", "../posts/PostsList/index.mjs", []],
  ["POST", "/posts", "../posts/PostCreate/index.mjs", []],
  ["GET", "/posts/:id", "../posts/PostsGet/index.mjs", ["id"]],
  ["PUT", "/posts/:id", "../posts/PostUpdate/index.mjs", ["id"]],
  ["DELETE", "/posts/:id", "../posts/PostDelete/index.mjs", ["id"]],

  // Comments
  ["GET", "/posts/:id/comments", "../comments/CommentsList/index.mjs", ["id"]],
  ["POST", "/posts/:id/comments", "../comments/CommentCreate/index.mjs", ["id"]],
  [
    "DELETE",
    "/posts/:id/comments/:commentId",
    "../comments/CommentDelete/index.mjs",
    ["id", "commentId"],
  ],

  // Users profile (frontend uses /admin/users/profile paths)
  ["GET", "/admin/users/profile", "../users/UsersGetProfile/index.mjs", []],
  ["PUT", "/admin/users/profile/email", "../users/UsersUpdateEmail/index.js", []],
  ["DELETE", "/admin/users/profile/email", "../users/UsersDeleteEmail/index.js", []],
  ["PUT", "/admin/users/profile/password", "../users/UsersUpdatePassword/index.js", []],
  ["POST", "/admin/users/profile/avatar", "../users/UsersAddAvatar/index.js", []],
  [
    "PUT",
    "/admin/users/profile/avatar/active",
    "../users/UsersSetActiveAvatar/index.js",
    [],
  ],
  [
    "DELETE",
    "/admin/users/profile/avatar/:avatarId",
    "../users/UsersDeleteAvatar/index.js",
    ["avatarId"],
  ],

  // Public user data
  ["GET", "/admin/users/:userId/avatars/:avatarId", "../users/UsersGetUserAvatar/index.js", ["userId", "avatarId"]],
];

// Handler cache
const handlerCache = new Map();

async function getHandler(handlerPath) {
  if (!handlerCache.has(handlerPath)) {
    const module = await import(handlerPath);
    handlerCache.set(handlerPath, module.handler);
  }
  return handlerCache.get(handlerPath);
}

function matchRoute(method, pathname) {
  for (const [routeMethod, pattern, handlerPath, _paramNames] of routes) {
    if (routeMethod !== method) continue;

    const patternParts = pattern.split("/");
    const pathParts = pathname.split("/");

    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    let match = true;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      return { handlerPath, params };
    }
  }
  return null;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Match route
    const matched = matchRoute(method, pathname);
    if (!matched) {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const { handlerPath, params } = matched;

    // Build Lambda event
    const headers = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const queryParams = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    let body = null;
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await req.text();
      } catch {
        body = null;
      }
    }

    const event = {
      httpMethod: method,
      headers,
      pathParameters: Object.keys(params).length > 0 ? params : null,
      queryStringParameters: Object.keys(queryParams).length > 0 ? queryParams : null,
      body,
    };

    // Call handler
    try {
      const handler = await getHandler(handlerPath);
      const result = await handler(event);

      return new Response(result.body, {
        status: result.statusCode,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      });
    } catch (err) {
      console.error(`Error in ${handlerPath}:`, err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }
  },
});

console.log(`Local API server running at http://127.0.0.1:${PORT}`);
console.log("Routes:");
for (const [method, pattern] of routes) {
  console.log(`  ${method.padEnd(7)} ${pattern}`);
}
