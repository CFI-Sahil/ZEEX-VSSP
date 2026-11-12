const { z } = require('zod');

/**
 * Helper to escape user-supplied regex characters to prevent regex injection attacks
 * @param {string} str
 * @returns {string}
 */
const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const evidenceVaultQuerySchema = z
  .object({
    page: z.coerce.number().int({ message: 'Page must be an integer' }).min(1, 'Page must be at least 1').default(1),
    limit: z.preprocess((val) => {
      if (val === undefined || val === '') return 12;
      const parsed = parseInt(String(val), 10);
      if (isNaN(parsed) || parsed < 1) return 12;
      return Math.min(parsed, 50);
    }, z.number().int().min(1).max(50).default(12)),
    search: z.string().trim().max(100, 'Search query cannot exceed 100 characters').optional(),
    camera: z.string().trim().optional(),
    cameraCode: z.string().trim().toUpperCase().optional(),
    alert: z.string().trim().optional(),
    alertCode: z.string().trim().toUpperCase().optional(),
    severity: z
      .enum(['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
        errorMap: () => ({ message: 'Severity must be ALL, LOW, MEDIUM, HIGH, or CRITICAL' }),
      })
      .optional()
      .default('ALL'),
    violationType: z
      .enum(
        [
          'ALL',
          'NO_HELMET',
          'NO_VEST',
          'UNAUTHORIZED_ZONE',
          'NO_SAFETY_BOOTS',
          'RESTRICTED_ACCESS',
          'OTHER',
        ],
        {
          errorMap: () => ({ message: 'Invalid violation type filter' }),
        }
      )
      .optional()
      .default('ALL'),
    storageDriver: z.preprocess((val) => {
      if (!val) return 'ALL';
      const upper = String(val).toUpperCase();
      if (upper === 'LOCAL') return 'local';
      if (upper === 'CLOUDINARY') return 'cloudinary';
      if (upper === 'ALL') return 'ALL';
      return String(val).toLowerCase();
    }, z.enum(['ALL', 'local', 'cloudinary']).default('ALL')),
    capturedFrom: z
      .string()
      .trim()
      .refine((val) => !val || !isNaN(Date.parse(val)), { message: 'capturedFrom must be a valid date' })
      .optional(),
    capturedTo: z
      .string()
      .trim()
      .refine((val) => !val || !isNaN(Date.parse(val)), { message: 'capturedTo must be a valid date' })
      .optional(),
    startDate: z
      .string()
      .trim()
      .refine(
        (val) => !val || !isNaN(Date.parse(val)),
        { message: 'startDate must be a valid ISO 8601 date string' }
      )
      .optional(),
    endDate: z
      .string()
      .trim()
      .refine(
        (val) => !val || !isNaN(Date.parse(val)),
        { message: 'endDate must be a valid ISO 8601 date string' }
      )
      .optional(),
    sortBy: z.preprocess((val) => {
      const allowed = ['capturedAt', 'fileSize', 'alertCode', 'evidenceCode'];
      if (!val || typeof val !== 'string' || !allowed.includes(val)) {
        return 'capturedAt';
      }
      return val;
    }, z.enum(['capturedAt', 'fileSize', 'alertCode', 'evidenceCode']).default('capturedAt')),
    sortOrder: z
      .enum(['asc', 'desc'], {
        errorMap: () => ({ message: 'sortOrder must be asc or desc' }),
      })
      .default('desc'),
  })
  .refine(
    (data) => {
      const from = data.capturedFrom || data.startDate;
      const to = data.capturedTo || data.endDate;
      if (from && to) {
        return new Date(from) <= new Date(to);
      }
      return true;
    },
    {
      message: 'Start date cannot be later than end date',
      path: ['startDate'],
    }
  );

module.exports = {
  evidenceVaultQuerySchema,
  escapeRegex,
};
