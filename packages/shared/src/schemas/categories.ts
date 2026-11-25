import { z } from 'zod';
import { issuerSchema } from '../constants';

/** URL-safe slug: lowercase letters/digits separated by single hyphens (e.g. `ahli-k3-umum`). */
export const slugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** `GET /api/v1/categories` takes no parameters. */
export const categoriesQuerySchema = z.strictObject({});

export const categorySchema = z.object({
  slug: slugSchema,
  name: z.string().min(1),
  issuers: z.array(issuerSchema).min(1),
  documentType: z.string().min(1),
  /** Typical validity for reminders; null when it depends on the scheme ("cek dokumen Anda"). */
  typicalValidityYears: z.number().int().min(1).max(50).nullable(),
  regulationRef: z.string().min(1),
});
export type Category = z.infer<typeof categorySchema>;

export const courseFieldSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1),
  categories: z.array(categorySchema),
});
export type CourseField = z.infer<typeof courseFieldSchema>;

export const categoriesResponseSchema = z.object({ items: z.array(courseFieldSchema) });
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;
