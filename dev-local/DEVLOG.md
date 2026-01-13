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
