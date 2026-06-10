import { z } from 'zod';

export const OkResponseSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    status: z.literal('ok'),
    data,
  });

export const AppliedResponseSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    status: z.literal('applied'),
    data,
  });

export const DroppedAsStaleResponseSchema = <T extends z.ZodTypeAny>(currentState: T) =>
  z.object({
    status: z.literal('dropped-as-stale'),
    currentState,
  });

export const ErrorResponseSchema = z.object({
  status: z.literal('error'),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
