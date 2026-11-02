const { z } = require('zod');

const createCameraSchema = z.object({
  cameraCode: z
    .string({ required_error: 'Camera identifier code is required' })
    .trim()
    .toUpperCase()
    .min(3, 'Camera code must be at least 3 characters')
    .max(20, 'Camera code cannot exceed 20 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Camera code must contain only uppercase letters, numbers, hyphens or underscores'),
  name: z
    .string({ required_error: 'Camera name is required' })
    .trim()
    .min(2, 'Camera name must be at least 2 characters')
    .max(100, 'Camera name cannot exceed 100 characters'),
  site: z
    .string({ required_error: 'Site location name is required' })
    .trim()
    .min(2, 'Site name must be at least 2 characters')
    .max(100, 'Site name cannot exceed 100 characters'),
  location: z
    .string({ required_error: 'Zone or location description is required' })
    .trim()
    .min(2, 'Location must be at least 2 characters')
    .max(100, 'Location cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(300, 'Description cannot exceed 300 characters')
    .optional()
    .default(''),
});

const updateCameraSchema = z.object({
  name: z.string().trim().min(2, 'Camera name must be at least 2 characters').max(100).optional(),
  site: z.string().trim().min(2, 'Site name must be at least 2 characters').max(100).optional(),
  location: z.string().trim().min(2, 'Location must be at least 2 characters').max(100).optional(),
  description: z.string().trim().max(300).optional(),
  status: z.enum(['UNKNOWN', 'ONLINE', 'OFFLINE'], {
    errorMap: () => ({ message: 'Status must be UNKNOWN, ONLINE, or OFFLINE' }),
  }).optional(),
});

const cameraQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['UNKNOWN', 'ONLINE', 'OFFLINE', 'ALL']).optional().default('ALL'),
});

module.exports = {
  createCameraSchema,
  updateCameraSchema,
  cameraQuerySchema,
};

