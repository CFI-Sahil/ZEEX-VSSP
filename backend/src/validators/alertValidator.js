const { z } = require('zod');

const alertQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['ALL', 'PENDING', 'ACKNOWLEDGED', 'CLOSED']).optional().default('ALL'),
  severity: z.enum(['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('ALL'),
  escalationLevel: z.coerce.number().int().min(1).max(3).optional(),
  cameraCode: z.string().trim().optional(),
});

const closeAlertSchema = z.object({
  remarks: z
    .string({ required_error: 'Closure remarks are required' })
    .trim()
    .min(3, 'Closure remarks must be at least 3 characters')
    .max(1000, 'Closure remarks cannot exceed 1000 characters'),
});

const ingestDemoEventSchema = z.object({
  eventId: z.string().trim().toUpperCase().optional(),
  cameraCode: z
    .string({ required_error: 'Camera code is required' })
    .trim()
    .toUpperCase()
    .min(1, 'Camera code cannot be empty'),
  violationType: z.enum(
    [
      'NO_HELMET',
      'NO_VEST',
      'UNAUTHORIZED_ZONE',
      'NO_SAFETY_BOOTS',
      'RESTRICTED_ACCESS',
      'OTHER',
    ],
    { required_error: 'Violation type is required' }
  ),
  violationName: z.string().trim().min(2).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    required_error: 'Severity is required',
  }),
  confidence: z.coerce.number().min(0.5).max(1.0).optional().default(0.92),
  description: z.string().trim().max(500).optional().default(''),
});

const evidenceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  cameraCode: z.string().trim().optional(),
  alertCode: z.string().trim().optional(),
});

module.exports = {
  alertQuerySchema,
  closeAlertSchema,
  ingestDemoEventSchema,
  evidenceQuerySchema,
};

