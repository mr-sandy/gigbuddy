import { z } from 'zod';

export const ClientErrorReportSchema = z.object({
  where: z.string().min(1),
  message: z.string().min(1),
  stack: z.string().optional(),
  performanceActive: z.boolean(),
  timestamp: z.string().datetime(),
});
export type ClientErrorReport = z.infer<typeof ClientErrorReportSchema>;
