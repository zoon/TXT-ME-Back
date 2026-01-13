/**
 * Zod schemas for contract validation
 * Derived from dev-local/specs/*.md
 */

import { z } from "zod";

// ============================================================================
// Common schemas
// ============================================================================

export const LambdaResponseSchema = z.object({
  statusCode: z.number(),
  headers: z.record(z.string()),
  body: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

// ============================================================================
// Auth schemas
// ============================================================================

// AuthRegister
export const AuthRegisterRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const AuthRegisterSuccessSchema = z.object({
  message: z.literal("User registered successfully. Awaiting activation by admin."),
  userId: z.string().uuid(),
});

// AuthLogin
export const AuthLoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const AuthLoginSuccessSchema = z.object({
  message: z.literal("Login successful"),
  token: z.string().min(1),
  user: z.object({
    userId: z.string(),
    username: z.string(),
    role: z.enum(["admin", "user"]),
  }),
});

// ============================================================================
// Post schemas
// ============================================================================

// PostCreate
export const PostCreateRequestSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  postAvatarId: z.string().optional(),
});

export const PostSchema = z.object({
  postId: z.string(),
  userId: z.string(),
  username: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  createdAt: z.union([z.number(), z.string()]),
  updatedAt: z.union([z.number(), z.string()]),
  commentCount: z.number().optional(),
  postAvatarId: z.string().optional(),
  status: z.string().optional(),
});

export const PostCreateSuccessSchema = z.object({
  message: z.literal("Post created successfully"),
  post: PostSchema,
});

// PostsList
export const PostsListSuccessSchema = z.object({
  posts: z.array(PostSchema),
  lastKey: z.string().optional(),
});

// PostsGet
export const PostsGetSuccessSchema = PostSchema;

// PostUpdate
export const PostUpdateRequestSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional(),
});

export const PostUpdateSuccessSchema = z.object({
  message: z.literal("Post updated successfully"),
  post: PostSchema,
});

// PostDelete
export const PostDeleteSuccessSchema = z.object({
  message: z.literal("Post deleted successfully"),
});

// ============================================================================
// Comment schemas
// ============================================================================

// CommentCreate
export const CommentCreateRequestSchema = z.object({
  content: z.string().min(1),
  parentCommentId: z.string().optional(),
  commentAvatarId: z.string().optional(),
});

export const CommentSchema = z.object({
  commentId: z.string(),
  postId: z.string(),
  userId: z.string(),
  username: z.string(),
  content: z.string(),
  createdAt: z.union([z.number(), z.string()]),
  parentCommentId: z.string().optional(),
  commentAvatarId: z.string().optional(),
});

export const CommentCreateSuccessSchema = z.object({
  message: z.literal("Comment created successfully"),
  comment: CommentSchema,
});

// CommentsList
export const CommentsListSuccessSchema = z.object({
  comments: z.array(CommentSchema),
  lastKey: z.string().optional(),
});

// CommentDelete
export const CommentDeleteSuccessSchema = z.object({
  message: z.literal("Comment deleted successfully"),
});

// ============================================================================
// User schemas
// ============================================================================

export const UserProfileSchema = z.object({
  userId: z.string(),
  username: z.string(),
  email: z.string().optional(),
  role: z.string().optional(),
  createdAt: z.union([z.number(), z.string()]).optional(),
  avatars: z.array(z.any()).optional(),
  activeAvatarId: z.string().optional(),
});

// UsersUpdateEmail
export const UsersUpdateEmailRequestSchema = z.object({
  email: z.string().email(),
});

export const UsersUpdateEmailSuccessSchema = z.object({
  message: z.literal("Email updated"),
  email: z.string(),
});

// UsersUpdatePassword
export const UsersUpdatePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

export const UsersUpdatePasswordSuccessSchema = z.object({
  message: z.literal("Password updated successfully"),
});

// UsersAddAvatar
export const UsersAddAvatarRequestSchema = z.object({
  dataUrl: z.string().min(1),
});

export const AvatarSchema = z.object({
  avatarId: z.string(),
  dataUrl: z.string(),
  uploadedAt: z.union([z.number(), z.string()]),
});

export const UsersAddAvatarSuccessSchema = z.object({
  avatar: AvatarSchema,
  activeAvatarId: z.string(),
});

// UsersSetActiveAvatar
export const UsersSetActiveAvatarRequestSchema = z.object({
  avatarId: z.string(),
});

export const UsersSetActiveAvatarSuccessSchema = z.object({
  message: z.literal("Active avatar set"),
  avatarId: z.string(),
});

// UsersDeleteAvatar
export const UsersDeleteAvatarSuccessSchema = z.object({
  message: z.string(),
});

// UsersGetUserAvatar
export const UsersGetUserAvatarSuccessSchema = z.object({
  userId: z.string(),
  username: z.string(),
  avatars: z.array(AvatarSchema),
  activeAvatarId: z.string().nullable(),
  avatarDataUrl: z.string().nullable(),
});

// UsersDeleteEmail
export const UsersDeleteEmailSuccessSchema = z.object({
  message: z.literal("Email removed successfully"),
});

// ============================================================================
// Validation helpers
// ============================================================================

/**
 * Validate Lambda response and parse body
 */
export function validateResponse<T>(
  response: { statusCode: number; headers: Record<string, string>; body: string },
  schema: z.ZodType<T>,
): T {
  LambdaResponseSchema.parse(response);
  const body = JSON.parse(response.body);
  return schema.parse(body);
}

/**
 * Assert response matches expected status and schema
 */
export function assertResponse<T>(
  response: { statusCode: number; headers: Record<string, string>; body: string },
  expectedStatus: number,
  schema: z.ZodType<T>,
): T {
  if (response.statusCode !== expectedStatus) {
    const body = JSON.parse(response.body);
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.statusCode}: ${JSON.stringify(body)}`,
    );
  }
  return validateResponse(response, schema);
}
