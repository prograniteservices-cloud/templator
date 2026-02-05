/**
 * Input Validation Schemas
 * 
 * Security Layer: Prevents injection attacks and ensures data integrity
 * Uses Zod for runtime type validation
 */

import { z } from 'zod';

// Job Status Enum
export const JobStatus = z.enum(['capturing', 'processing', 'complete', 'error']);

// Measurements Schema
export const MeasurementsSchema = z.object({
  squareFeet: z.number().positive().max(10000).optional(),
  length: z.number().positive().max(1000).optional(),
  width: z.number().positive().max(1000).optional(),
});

// Job Schema - validates job data structure
export const JobSchema = z.object({
  id: z.string().optional(), // Firestore auto-generates this
  customerName: z.string()
    .min(1, 'Customer name is required')
    .max(100, 'Customer name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-\.]+$/, 'Customer name contains invalid characters'),
  address: z.string()
    .min(1, 'Address is required')
    .max(200, 'Address must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s\-\.,#]+$/, 'Address contains invalid characters'),
  status: JobStatus,
  createdAt: z.union([z.date(), z.any()]).optional(), // Firestore Timestamp
  updatedAt: z.union([z.date(), z.any()]).optional(), // Firestore Timestamp
  createdBy: z.string().optional(), // User UID
  measurements: MeasurementsSchema.optional(),
  blueprintData: z.string()
    .max(50000, 'Blueprint data exceeds maximum size')
    .optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  analysisNotes: z.string()
    .max(5000, 'Analysis notes exceed maximum length')
    .optional(),
  videoUri: z.string()
    .max(500, 'Video URI exceeds maximum length')
    .optional(),
});

// Create Job Schema (for new job creation)
export const CreateJobSchema = JobSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  createdBy: true 
});

// Update Job Schema (for job updates)
export const UpdateJobSchema = JobSchema.partial().omit({ 
  id: true, 
  createdBy: true 
});

// Blueprint SVG Schema - sanitizes and validates SVG content
export const BlueprintSVGSchema = z.string()
  .max(50000, 'SVG content too large')
  .refine(
    (val) => {
      // Check for dangerous tags
      const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form'];
      const lowerVal = val.toLowerCase();
      return !dangerousTags.some(tag => lowerVal.includes(`<${tag}`));
    },
    {
      message: 'SVG contains potentially dangerous content',
    }
  );

// Validate job data before saving to Firestore
export function validateJob(data: unknown): z.infer<typeof JobSchema> {
  return JobSchema.parse(data);
}

// Validate create job data
export function validateCreateJob(data: unknown): z.infer<typeof CreateJobSchema> {
  return CreateJobSchema.parse(data);
}

// Validate update job data
export function validateUpdateJob(data: unknown): z.infer<typeof UpdateJobSchema> {
  return UpdateJobSchema.parse(data);
}

// Validate blueprint SVG
export function validateBlueprintSVG(svg: string): string {
  return BlueprintSVGSchema.parse(svg);
}

// Safe job sanitization - removes any unexpected fields
export function sanitizeJobData(data: unknown): Partial<z.infer<typeof JobSchema>> {
  const result = JobSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // If validation fails, return only safe fields
  const safeFields = ['customerName', 'address', 'status', 'measurements', 'analysisNotes'];
  const safe: Record<string, unknown> = {};
  if (typeof data === 'object' && data !== null) {
    safeFields.forEach(field => {
      if (field in data) {
        safe[field] = (data as Record<string, unknown>)[field];
      }
    });
  }
  return safe;
}

// Type exports
export type Job = z.infer<typeof JobSchema>;
export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
