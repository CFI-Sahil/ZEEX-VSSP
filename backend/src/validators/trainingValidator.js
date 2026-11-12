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

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const CANONICAL_VIOLATIONS = [
  'NO_HELMET',
  'NO_VEST',
  'UNAUTHORIZED_ZONE',
  'NO_SAFETY_BOOTS',
  'RESTRICTED_ACCESS',
  'OTHER',
];

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

// 1. Scenario Query Schema
const scenarioQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.preprocess((val) => {
    if (val === undefined || val === '') return 12;
    const parsed = parseInt(String(val), 10);
    if (isNaN(parsed) || parsed < 1) return 12;
    return Math.min(parsed, 50);
  }, z.number().int().min(1).max(50).default(12)),
  difficulty: z
    .preprocess((v) => (v ? String(v).toUpperCase() : 'ALL'), z.enum(['ALL', ...DIFFICULTIES]))
    .optional()
    .default('ALL'),
  violationType: z
    .preprocess((v) => (v ? String(v).toUpperCase() : 'ALL'), z.enum(['ALL', ...CANONICAL_VIOLATIONS]))
    .optional()
    .default('ALL'),
  status: z
    .preprocess((v) => (v ? String(v).toUpperCase() : 'ALL'), z.enum(['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED']))
    .optional()
    .default('ALL'),
  search: z.string().trim().max(100).optional(),
});

// 2. Scenario Create Schema
const scenarioCreateSchema = z.object({
  scenarioCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,20}$/, 'Scenario code must be 3-20 uppercase alphanumeric, dash or underscore characters')
    .optional(),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(1000),
  objective: z.string().trim().min(5, 'Objective must be at least 5 characters').max(500),
  violationType: z.enum(CANONICAL_VIOLATIONS, {
    errorMap: () => ({ message: 'Invalid violation type' }),
  }),
  severity: z.enum(SEVERITIES, {
    errorMap: () => ({ message: 'Invalid severity level' }),
  }),
  difficulty: z.enum(DIFFICULTIES).default('BEGINNER'),
  estimatedMinutes: z.coerce.number().int().min(1).max(120).default(10),
  instructions: z.union([z.array(z.string().trim()), z.string().trim()]).transform((val) => {
    if (Array.isArray(val)) return val;
    return val ? [val] : [];
  }).default([]),
  learningObjectives: z.array(z.string().trim()).default([]),
  simulatedAlertContext: z
    .object({
      alertCode: z.string().trim().optional(),
      cameraCode: z.string().trim().optional(),
      cameraName: z.string().trim().optional(),
      location: z.string().trim().optional(),
      site: z.string().trim().optional(),
      contractor: z.string().trim().optional(),
      workFrontCode: z.string().trim().optional(),
      workFrontName: z.string().trim().optional(),
      riskLevel: z.enum(SEVERITIES).optional(),
      detectedAtOffsetMinutes: z.coerce.number().min(0).max(1440).optional(),
    })
    .optional(),
  simulatedEvidence: z
    .object({
      fileName: z.string().trim().optional(),
      fixtureType: z.enum(['HELMET', 'ZONE', 'VEST', 'BOOTS', 'GENERIC']).optional(),
      fileUrl: z.string().trim().optional(),
      mimeType: z.string().trim().optional(),
      caption: z.string().trim().optional(),
    })
    .optional(),
  expectedEvaluation: z.object({
    expectedViolationType: z.enum(CANONICAL_VIOLATIONS),
    expectedSeverity: z.enum(SEVERITIES),
    expectedImmediateResponse: z.string().trim().min(2, 'Expected immediate response required'),
    expectedCorrectiveActionCategory: z.string().trim().min(2, 'Expected corrective action category required'),
    minimumRemarksLength: z.coerce.number().int().min(5).max(100).default(15),
    weights: z
      .object({
        violationId: z.coerce.number().min(0).max(100).optional(),
        severity: z.coerce.number().min(0).max(100).optional(),
        acknowledgment: z.coerce.number().min(0).max(100).optional(),
        immediateResponse: z.coerce.number().min(0).max(100).optional(),
        correctiveAction: z.coerce.number().min(0).max(100).optional(),
        resolutionRemarks: z.coerce.number().min(0).max(100).optional(),
      })
      .optional(),
  }),
});

// 3. Scenario Update Schema
const scenarioUpdateSchema = scenarioCreateSchema.partial().extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

// 4. Session Start Schema
const startSessionSchema = z.object({
  scenarioId: z.string().regex(objectIdRegex, 'Invalid scenario ObjectId format'),
});

// 5. Session Acknowledge Schema
const acknowledgeSessionSchema = z.object({
  remarks: z.string().trim().max(500).optional().default(''),
});

// 6. Session Assess Schema
const assessSessionSchema = z.object({
  assessedViolationType: z.enum(CANONICAL_VIOLATIONS, {
    errorMap: () => ({ message: 'Invalid violation type assessment' }),
  }),
  assessedSeverity: z.enum(SEVERITIES, {
    errorMap: () => ({ message: 'Invalid severity assessment' }),
  }),
  assessedRiskLevel: z.enum(SEVERITIES).optional(),
  selectedImmediateResponse: z.string().trim().min(2, 'Immediate response selection is required').max(100),
  correctiveActionCategory: z.string().trim().min(2, 'Corrective action category is required').max(100),
  correctiveActionRemarks: z.string().trim().max(1000).optional().default(''),
});

// 7. Session Corrective Action Schema
const correctiveActionSchema = z.object({
  correctiveActionCategory: z.string().trim().min(2, 'Corrective action category is required').max(100),
  correctiveActionRemarks: z.string().trim().max(1000).optional().default(''),
});

// 8. Session Complete Schema
const completeSessionSchema = z.object({
  resolutionRemarks: z
    .string()
    .trim()
    .min(5, 'Resolution remarks must be at least 5 characters long')
    .max(1000),
});

// 9. Session History Query Schema
const sessionHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.preprocess((val) => {
    if (val === undefined || val === '') return 10;
    const parsed = parseInt(String(val), 10);
    if (isNaN(parsed) || parsed < 1) return 10;
    return Math.min(parsed, 50);
  }, z.number().int().min(1).max(50).default(10)),
  status: z
    .preprocess((v) => (v ? String(v).toUpperCase() : 'ALL'), z.enum(['ALL', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']))
    .optional()
    .default('ALL'),
  sortBy: z.enum(['startedAt', 'completedAt', 'totalScore', 'createdAt']).optional().default('startedAt'),
  sortOrder: z.preprocess((v) => (String(v).toLowerCase() === 'asc' ? 1 : -1), z.number().int()).default(-1),
  search: z.string().trim().max(100).optional(),
});

module.exports = {
  escapeRegex,
  objectIdRegex,
  scenarioQuerySchema,
  scenarioCreateSchema,
  scenarioUpdateSchema,
  startSessionSchema,
  acknowledgeSessionSchema,
  assessSessionSchema,
  correctiveActionSchema,
  completeSessionSchema,
  sessionHistoryQuerySchema,
  CANONICAL_VIOLATIONS,
  SEVERITIES,
  DIFFICULTIES,
};

