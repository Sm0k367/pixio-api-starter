// src/lib/validators/book.validators.ts
import { z } from 'zod';

export const generateBookSchema = z.object({
  story_idea: z.string().min(10, { message: 'Please describe your story idea (at least 10 characters).' }).max(1000, { message: 'Story idea cannot exceed 1000 characters.' }),
});

export type TGenerateBookSchema = z.infer<typeof generateBookSchema>;

