import { z } from 'zod';

/** Response of `GET /api/v1/health`. `version` is the deployed commit, or `dev` locally. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string().min(1).max(64),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
