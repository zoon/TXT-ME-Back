# DEVLOG

## 2026-01-13: Terraform + DynamoDB Local incompatibility

**Problem:** Terraform AWS provider v6+ fails with DynamoDB Local despite mock credentials.

```
UnrecognizedClientException: The Access Key ID or security token is invalid
```

**Root cause:** Provider validates credentials against AWS STS before any operation. `skip_credentials_validation = true` is ignored in newer versions.

**Workarounds:**
- Pin provider to `~> 4.0` (pre-validation behavior)
- Use LocalStack (mocks STS endpoint)
- Use dedicated local provider

**Solution chosen:** Node.js script (`create-tables.mjs`) using `@aws-sdk/client-dynamodb`. Simpler, same language as Lambdas, no extra tooling.

---

## 2026-01-13: WSL2 localhost IPv6 quirk

**Problem:** AWS SDK hanging when connecting to `localhost:8000`.

**Root cause:**
- `getent hosts localhost` returns `::1` (IPv6) first
- `systemd-resolved` has built-in localhost handling ignoring `/etc/hosts`
- IPv6 connection to Docker container intermittently stalls

**Fix:** Add to `/etc/gai.conf`:
```
precedence ::ffff:0:0/96  100
```

Forces `getaddrinfo()` (used by Node.js, Python, etc.) to prefer IPv4.

**Verification:**
```bash
node -e "require('dns').lookup('localhost', (err, addr) => console.log(addr))"
# Should print: 127.0.0.1
```

---

## 2026-01-13: DynamoDB Local persistence

**Problem:** `-inMemory` mode loses data on container restart.

**Initial blocker:** Volume mount created `data/dynamodb` as root → SQLite permission error inside container.

**Solution:**
```bash
mkdir -p data/dynamodb && chmod 777 data/dynamodb
```

Added to `setup-db.sh` so fresh clones work automatically.

**Structure:**
```
dev-local/
  data/dynamodb/    # persistent storage (gitignored)
```

---

## 2026-01-14: Local API server for frontend development

**Problem:** Frontend (TXT-ME) needed to run against local backend instead of production AWS Lambda.

**Challenge:** Lambda handlers are standalone files with no HTTP server. Tests import them directly but frontend needs HTTP endpoints.

**Solution:** Created `server.mjs` using Bun.serve() that:
1. Maps HTTP routes to Lambda handler imports
2. Converts HTTP requests to Lambda event format
3. Returns Lambda responses as HTTP responses
4. Handles CORS preflight

**Gotcha:** Handler directories had no `node_modules` (designed for Lambda bundling). Fixed by symlinking to `dev-local/node_modules`:
```bash
for dir in auth/*/ posts/*/ comments/*/ users/*/; do
  ln -sf "$(pwd)/dev-local/node_modules" "${dir}node_modules"
done
```

**Gotcha:** AWS SDK credential conflict warning. Fixed by deleting `AWS_PROFILE` before handler imports.

**Usage:**
```bash
bun run server  # API on :3001
VITE_API_URL=http://127.0.0.1:3001 npm run dev  # Frontend
```

---

## 2026-01-14: User activation CLI

**Problem:** New users registered via frontend can't login - `AuthLogin` checks for `role` field.

**Solution:** Created `scripts/activate-user.mjs` CLI:
```bash
bun run activate           # List users
bun run activate <user>    # Set role='user'
bun run activate <user> admin  # Set role='admin'
bun run activate --all     # Activate all pending
```
