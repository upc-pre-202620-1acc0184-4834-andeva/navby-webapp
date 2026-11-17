import { z } from 'zod';

export const UserSummarySchema = z.object({
  user_id: z.string(),
  email: z.string(),
  full_name: z.string(),
  email_verified: z.boolean(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

export const SessionSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  expires_in: z.number(),
  user: UserSummarySchema,
});

export type Session = z.infer<typeof SessionSchema>;

export const UserProfileSchema = UserSummarySchema.extend({
  has_password: z.boolean(),
  has_google: z.boolean(),
  created_at: z.string(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const HealthSchema = z.object({
  status: z.enum(['UP', 'DOWN']),
  postgres: z.string(),
  redis: z.string(),
  graph: z.object({
    status: z.string(),
    nodes: z.number(),
    edges: z.number(),
  }),
});

export type HealthStatus = z.infer<typeof HealthSchema>;
