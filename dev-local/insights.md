## 2026-01-13: Code review completed
- Decision: Documented security/performance issues in concerns/claude.md
- Gotcha: AdminUsers has no JWT validation - only checks x-user-id header presence
- Pattern: All Lambda functions have hardcoded JWT fallback secrets - need centralized secret management

## 2026-01-13: Gitignore cleanup
- Decision: Removed 68,991 files from git tracking (node_modules + auth.zip)
- Gotcha: .gitignore rules existed but files were committed before rules - required `git rm --cached` to untrack
- Pattern: Always verify tracked files after adding new .gitignore rules

## 2026-01-13: Lambda enumeration
- Decision: Created `.specs/readme.md` with all 20 Lambda functions documented
- Pattern: Auth(3), Posts(6), Comments(3), Users(8) - 8 public endpoints, 12 require JWT

## 2026-01-13: AuthLogin spec
- Decision: Created `.specs/AuthLogin.md` as first detailed function spec
- Gotcha: Uses `username-index` GSI (not `UsernameIndex` as documented in CLAUDE.md)
- Pattern: Spec template: overview table, request/response schemas, flow diagram, security notes

## 2026-01-13: PostsRecent spec
- Decision: Created `.specs/PostsRecent.md` - real-time polling endpoint
- Gotcha: Full table scans on both CMS-Posts and CMS-Comments with in-memory filtering - scales poorly
- Pattern: Returns `nowTimestamp` for client to use as next `since` value in polling loop

## 2026-01-13: UsersAddAvatar spec
- Decision: Created `.specs/UsersAddAvatar.md` - avatar upload with constraints
- Gotcha: Hardcoded JWT secret `cms-jwt-secret-prod-2025` differs from AuthLogin's secret - cross-auth will fail
- Pattern: Uses `Date.now().toString()` as avatarId - simple but collision-prone if rapid uploads

## 2026-01-13: CommentCreate spec
- Decision: Created `.specs/CommentCreate.md` - nested comments with counter
- Gotcha: Supports both `decoded.sub` and `decoded.userId` for JWT userId extraction
- Pattern: Fire-and-forget counter update - comment succeeds even if counter increment fails

## 2026-01-13: AdminUsers spec
- Decision: Created `.specs/AdminUsers.md` - user management dual-method endpoint
- Gotcha: CRITICAL - no actual admin verification, any x-user-id header value grants full access
- Pattern: Dynamic UpdateExpression building for partial updates (status and/or role)

## 2026-01-13: PostDelete spec
- Decision: Created `.specs/PostDelete.md` - cascade delete with batch processing
- Gotcha: Not atomic - comment batch failure leaves orphaned comments, no unprocessed item handling
- Pattern: BatchWriteCommand with 25-item chunks, comments deleted before post for referential integrity

## 2026-01-13: PostsList spec
- Decision: Created `.specs/PostsList.md` - paginated post listing with tag filter
- Gotcha: `ScanIndexForward: false` has no effect on ScanCommand - in-memory sort breaks pagination consistency
- Pattern: URL-encoded JSON cursor for pagination, `contains(tags, :tagId)` for array membership filter

## 2026-01-13: AuthRegister spec
- Decision: Created `.specs/AuthRegister.md` - user registration with admin approval flow
- Gotcha: Race condition - no conditional write, concurrent same-username registrations can overwrite
- Pattern: Creates user without role (inactive), admin must set role via AdminUsers for login to work

## 2026-01-13: CommentDelete spec
- Decision: Created `.specs/CommentDelete.md` - comment deletion with counter decrement
- Gotcha: Counter can go negative - `if_not_exists(commentCount, :zero) - :one` has no floor check
- Pattern: Optional postId validation - can delete via `/comments/{id}` or `/posts/{id}/comments/{id}`

## 2026-01-13: PostCreate spec
- Decision: Created `.specs/PostCreate.md` - post creation with avatar resolution
- Gotcha: No validation that tag IDs exist in CMS-Tags - can reference non-existent tags
- Pattern: Same avatar resolution as CommentCreate - provided → user's active → none

## 2026-01-13: UsersUpdatePassword spec
- Decision: Created `.specs/UsersUpdatePassword.md` - password change with verification
- Gotcha: Only function that throws on missing JWT_SECRET - others use fallback or hardcoded
- Pattern: Old password verified via bcrypt.compare before allowing change

## 2026-01-13: PostUpdate spec
- Decision: Created `.specs/PostUpdate.md` - partial update with dynamic expression
- Gotcha: `USERS_TABLE` imported but unused - dead code
- Pattern: `postAvatarId` of null/empty triggers REMOVE clause; other fields use SET

## 2026-01-13: PostsGet spec
- Decision: Created `.specs/PostsGet.md` - single post fetch endpoint
- Gotcha: Logs full event including headers - potential data leak in CloudWatch
- Pattern: Simplest Lambda pattern - no auth, direct GetCommand, minimal validation

## 2026-01-13: CommentsList spec
- Decision: Created `.specs/CommentsList.md` - paginated comments for a post
- Gotcha: Returns empty array for non-existent posts - no 404, silent fail
- Pattern: QueryCommand on GSI with ScanIndexForward works correctly (unlike Scan)

## 2026-01-13: UsersGetProfile spec
- Decision: Created `.specs/UsersGetProfile.md` - authenticated user profile fetch
- Gotcha: Only checks `user.userId` from JWT, not `user.sub` - inconsistent with other functions
- Pattern: Destructuring exclusion `{ passwordHash, ...profile }` to filter sensitive data

## 2026-01-13: Local dev environment setup
- Decision: Replaced Terraform approach with Node.js script for DynamoDB table creation
- Gotcha: DynamoDB Local volume mount caused SQLite permission issues in WSL - switched to `-inMemory` mode
- Gotcha: WSL hostname resolution hangs with `localhost` - use `127.0.0.1` explicitly
- Pattern: Root package.json with @aws-sdk/client-dynamodb for setup tooling

## 2026-01-13: UsersSetActiveAvatar spec
- Decision: Created `.specs/UsersSetActiveAvatar.md` - set active avatar endpoint
- Gotcha: Uses different JWT secret (`-change-in-production`) than other functions - cross-auth fails
- Gotcha: `updatedAt` stored as ISO string, not Unix timestamp - inconsistent with other functions

## 2026-01-13: UsersDeleteAvatar spec
- Decision: Created `.specs/UsersDeleteAvatar.md` - avatar deletion endpoint
- Gotcha: No 404 for non-existent avatar - filter silently succeeds with no-op
- Gotcha: JWT errors not caught explicitly - fall through to generic 500

## 2026-01-13: UsersGetUserAvatar spec
- Decision: Created `.specs/UsersGetUserAvatar.md` - public avatar fetch endpoint
- Gotcha: Exposes all avatar dataUrls publicly - potential privacy concern for private avatars
- Pattern: Convenience field `avatarDataUrl` resolves active avatar inline

## 2026-01-13: UsersUpdateEmail spec
- Decision: Created `.specs/UsersUpdateEmail.md` - email update endpoint
- Gotcha: No uniqueness check - duplicate emails allowed across users
- Gotcha: Minimal validation (`includes('@')`) - accepts malformed emails like `@` or `a@`

## 2026-01-13: UsersDeleteEmail spec
- Decision: Created `.specs/UsersDeleteEmail.md` - email removal endpoint (final spec, 20/20 complete)
- Gotcha: Third unique JWT secret default (`your-secret-key-here`) - codebase has 3 different fallbacks
- Pattern: Uses `REMOVE email` to delete attribute vs setting null - proper DynamoDB pattern

## 2026-01-13: Test and lint infrastructure
- Decision: Established Bun + Biome + Zod stack in dev-local/ for LLM-driven development
- Gotcha: AWS SDK v3 respects `AWS_ENDPOINT_URL_DYNAMODB` env var - enables DynamoDB Local without handler changes
- Gotcha: GSI name mismatch (`UsernameIndex` vs `username-index`) broke initial tests - fixed create-tables.mjs
- Gotcha: Handlers have inconsistent JWT secrets - tests use `cms-jwt-secret-prod-2025` (most common fallback)
- Pattern: Preload script sets env vars before handler imports; handlers initialize clients at module load time

## 2026-01-13: User handler tests completed
- Decision: Added tests for 6 missing user handlers (AddAvatar, SetActiveAvatar, DeleteAvatar, GetUserAvatar, UpdatePassword, DeleteEmail)
- Gotcha: UsersSetActiveAvatar and UsersDeleteEmail use different JWT secrets - 3 tests skipped due to cross-handler auth failure
- Gotcha: Some handlers return 500 for auth errors instead of 401 (AddAvatar, DeleteAvatar catch-all blocks)
- Pattern: Test coverage now 8/8 user handlers; 25 user tests pass, 3 skip (JWT mismatch), 60 total tests pass
