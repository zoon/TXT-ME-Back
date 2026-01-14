## 2026-01-13: Code review completed

- Decision: Documented security/performance issues in concerns/claude.md
- Gotcha: AdminUsers has no JWT validation - only checks x-user-id header presence
- Pattern: All Lambda functions have hardcoded JWT fallback secrets - need centralized secret management

## 2026-01-13: Gitignore cleanup

- Decision: Removed 68,991 files from git tracking (node_modules + auth.zip)
- Gotcha: .gitignore rules existed but files were committed before rules - required `git rm --cached` to untrack
- Pattern: Always verify tracked files after adding new .gitignore rules

## 2026-01-13: Test and lint infrastructure

- Decision: Established Bun + Biome + Zod stack in dev-local/ for LLM-driven development
- Gotcha: AWS SDK v3 respects `AWS_ENDPOINT_URL_DYNAMODB` env var - enables DynamoDB Local without handler changes
- Gotcha: GSI name mismatch (`UsernameIndex` vs `username-index`) broke initial tests - fixed create-tables.mjs
- Gotcha: Handlers have inconsistent JWT secrets - tests use `cms-jwt-secret-prod-2025` (most common fallback)
- Pattern: Preload script sets env vars before handler imports; handlers initialize clients at module load time

## 2026-01-13: User handler tests completed

- Decision: Added tests for 6 missing user handlers (AddAvatar, SetActiveAvatar, DeleteAvatar, GetUserAvatar, UpdatePassword, DeleteEmail)
- Gotcha: UsersSetActiveAvatar and UsersDeleteEmail previously used different JWT secrets - fixed, all tests now pass
- Gotcha: Some handlers return 500 for auth errors instead of 401 (AddAvatar, DeleteAvatar catch-all blocks)
- Pattern: Test coverage now 8/8 user handlers; all 28 user tests pass, 63 total tests pass

## 2026-01-13: JWT secret centralization

- Decision: Standardized all 13 JWT-using functions to `process.env.JWT_SECRET || 'cms-jwt-secret-prod-2025'`
- Gotcha: AuthLogin was signing tokens with different secret than most verification handlers - cross-function auth broken
- Gotcha: UsersUpdatePassword kept strict (throws if no env var) - intentionally different pattern
- Pattern: `.mjs` files use double quotes, `.js` files use single quotes for consistency
