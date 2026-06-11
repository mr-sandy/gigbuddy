import { z } from 'zod';
import { OkResponseSchema } from './api.js';

export const LoginRequestSchema = z.object({
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginAppliedResponseSchema = z.object({
  status: z.literal('applied'),
});
export type LoginAppliedResponse = z.infer<typeof LoginAppliedResponseSchema>;

export const MeDataSchema = z.object({
  authenticated: z.literal(true),
  daysUntilExpiry: z.number().int().nonnegative(),
});
export type MeData = z.infer<typeof MeDataSchema>;

export const MeResponseSchema = OkResponseSchema(MeDataSchema);
export type MeResponse = z.infer<typeof MeResponseSchema>;
