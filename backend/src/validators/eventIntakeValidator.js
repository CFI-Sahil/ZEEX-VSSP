const { z } = require('zod');
const { SUPPORTED_DETECTION_CODES, isValidDetectionCode } = require('../constants/detectionRegistry');

const MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000; // 5 minutes tolerance for clock drift

const eventIntakeSchema = z
  .object({
    eventId: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Event ID must be at least 3 characters')
      .max(64, 'Event ID cannot exceed 64 characters')
      .regex(/^[A-Z0-9\-_]+$/, 'Event ID must contain only alphanumeric characters, dashes, and underscores')
      .optional(),
    source: z.enum(['DEMO', 'EXTERNAL_CV']).optional().default('DEMO'),
    cameraCode: z
      .string({ required_error: 'Camera code is required' })
      .trim()
      .toUpperCase()
      .min(1, 'Camera code cannot be empty')
      .max(50, 'Camera code cannot exceed 50 characters'),
    violationType: z
      .string({ required_error: 'Violation type is required' })
      .trim()
      .toUpperCase()
      .refine(
        (code) => isValidDetectionCode(code),
        {
          message: `Unsupported detection/violation type. Must be one of: ${SUPPORTED_DETECTION_CODES.join(', ')}`,
        }
      ),
    violationName: z.string().trim().max(100).optional(),
    severity: z
      .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
        errorMap: () => ({ message: 'Severity must be LOW, MEDIUM, HIGH, or CRITICAL' }),
      })
      .optional(),
    confidence: z.coerce
      .number()
      .min(0.0, 'Confidence cannot be less than 0.0')
      .max(1.0, 'Confidence cannot exceed 1.0')
      .optional()
      .default(0.92),
    occurredAt: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const parsed = Date.parse(val);
          return !isNaN(parsed);
        },
        { message: 'occurredAt must be a valid ISO 8601 date string' }
      )
      .refine(
        (val) => {
          if (!val) return true;
          const timestamp = new Date(val).getTime();
          const now = Date.now();
          return timestamp <= now + MAX_FUTURE_DRIFT_MS;
        },
        { message: 'occurredAt cannot be future-dated beyond 5 minutes' }
      ),
    description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().default(''),
    evidenceMetadata: z
      .object({
        fileName: z.string().trim().max(255).optional(),
        fileType: z.string().trim().max(100).optional(),
        fileSize: z.coerce.number().min(0).max(10 * 1024 * 1024).optional(),
        sourceUrl: z.string().url().optional(),
      })
      .optional(),
  })
  .strict(); // Disallow untrusted operational context fields (e.g. workFront, contractor spoofing)

const eventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['ALL', 'RECEIVED', 'ACCEPTED', 'REJECTED', 'FAILED']).optional().default('ALL'),
  source: z.enum(['ALL', 'DEMO', 'EXTERNAL_CV']).optional().default('ALL'),
  cameraCode: z.string().trim().optional(),
});

module.exports = {
  eventIntakeSchema,
  eventQuerySchema,
};
