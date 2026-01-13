# Local Development Environment

DynamoDB Local setup for local Lambda development.

## Quick Start

```bash
./setup-db.sh
```

This will:
1. Create data directory with correct permissions
2. Start DynamoDB Local container (port 8000)
3. Install Node.js dependencies
4. Create all required tables

## Endpoints

| Service | URL |
|---------|-----|
| DynamoDB Local | http://127.0.0.1:8000 |

## Commands

```bash
# Start fresh
./setup-db.sh

# Stop
docker-compose down

# Restart (preserves data)
docker-compose restart

# View logs
docker-compose logs -f

# Reset data
rm -rf data/dynamodb && ./setup-db.sh
```

## Tables Created

- `CMS-Users` - User accounts
- `CMS-Posts` - Blog posts
- `CMS-Comments` - Comments
- `CMS-Tags` - Tags

## Structure

```
dev-local/
  docker-compose.yml    # DynamoDB Local config
  setup-db.sh           # Setup script
  package.json          # Dev dependencies
  scripts/
    create-tables.mjs   # Table creation
  data/
    dynamodb/           # Persistent storage (gitignored)
```

## Connecting from Lambda code

```javascript
const client = new DynamoDBClient({
  region: "eu-north-1",
  endpoint: "http://127.0.0.1:8000",
  credentials: { accessKeyId: "local", secretAccessKey: "local" }
});
```

## Troubleshooting

**WSL localhost issues:** Use `127.0.0.1` instead of `localhost`. See DEVLOG.md for details.

**Permission errors:** Run `chmod 777 data/dynamodb` or delete and re-run setup.
