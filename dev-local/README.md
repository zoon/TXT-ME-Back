# Local Development Environment

DynamoDB Local + API server for full-stack local development.

## Quick Start

```bash
./setup-db.sh        # Start DynamoDB, create tables, link dependencies
bun run server       # Start API server on :3001
```

Then run frontend with:
```bash
cd ../TXT-ME
VITE_API_URL=http://127.0.0.1:3001 npm run dev
```

## Endpoints

| Service | URL |
|---------|-----|
| API Server | http://127.0.0.1:3001 |
| DynamoDB Local | http://127.0.0.1:8000 |

## Commands

```bash
# Database
./setup-db.sh              # Start DynamoDB + create tables
docker-compose down        # Stop DynamoDB
docker-compose restart     # Restart (preserves data)
rm -rf data/dynamodb && ./setup-db.sh  # Reset data

# Server
bun run server             # Start API server

# User management
bun run activate           # List all users
bun run activate <user>    # Activate user as 'user' role
bun run activate <user> admin  # Activate as 'admin'
bun run activate --all     # Activate all pending users

# Testing
bun test                   # Run all tests
bun run test:watch         # Watch mode
bun run lint               # Lint check
bun run ci                 # Full CI pipeline
```

## Tables Created

- `CMS-Users` - User accounts
- `CMS-Posts` - Blog posts
- `CMS-Comments` - Comments
- `CMS-Tags` - Tags

## Structure

```
dev-local/
  server.mjs            # Local API server (routes to Lambda handlers)
  docker-compose.yml    # DynamoDB Local config
  setup-db.sh           # Setup script
  package.json          # Dev dependencies & scripts
  scripts/
    create-tables.mjs   # Table creation
    activate-user.mjs   # User activation CLI
  test/                 # Integration tests
  data/
    dynamodb/           # Persistent storage (gitignored)
```

## Frontend Integration

The API server (`server.mjs`) routes HTTP requests to Lambda handlers. Frontend connects via `VITE_API_URL` env var:

```bash
# In TXT-ME frontend directory
VITE_API_URL=http://127.0.0.1:3001 npm run dev
```

New users registered via frontend need activation before login:
```bash
bun run activate <username>
```

## Connecting from Lambda code

```javascript
const client = new DynamoDBClient({
  region: "eu-north-1",
  endpoint: "http://127.0.0.1:8000",
  credentials: { accessKeyId: "local", secretAccessKey: "local" }
});
```

## How It Works

Lambda handlers (e.g., `auth/AuthLogin/`) have no local `node_modules` — they're bundled at deploy time. For local dev, `setup-db.sh` creates symlinks from each handler directory to `dev-local/node_modules`, allowing the API server to import and run handlers locally.

## Troubleshooting

**WSL localhost issues:** Use `127.0.0.1` instead of `localhost`. See DEVLOG.md for details.

**Permission errors:** Run `chmod 777 data/dynamodb` or delete and re-run setup.

**Missing dependencies:** Re-run `./setup-db.sh` to recreate symlinks.
