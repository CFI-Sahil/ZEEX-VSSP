const { z } = require('zod');

const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const SHIFT_TYPES = ['DAY', 'NIGHT', 'SWING', 'CUSTOM'];
const HANDOVER_STATUSES = ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'];
const FOLLOWUP_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const NOTE_CATEGORIES = [
  'SAFETY_OBSERVATION',
  'SUPERVISOR_REQUEST',
  'SITE_RESTRICTION',
  'EQUIPMENT_HOLD',
  'GENERAL',
];

// 1. Create Handover Draft Schema
const createHandoverSchema = z.object({
  shiftDate: z.coerce.date().optional().default(() => new Date()),
  shiftType: z.enum(SHIFT_TYPES).optional().default('DAY'),
  shiftLabel: z.string().trim().min(2, 'Shift label must be at least 2 characters').max(100),
  incomingOperatorId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'Invalid incoming operator ObjectId')
    .optional()
    .nullable(),
  outgoingRemarks: z.string().trim().max(2000).optional().default(''),
  selectedAlertIds: z.array(z.string().regex(objectIdRegex)).optional().default([]),
  manualNotes: z
    .array(
      z.object({
        category: z.enum(NOTE_CATEGORIES).default('GENERAL'),
        note: z.string().trim().min(2).max(1000),
        priority: z.enum(PRIORITIES).default('MEDIUM'),
      })
    )
    .optional()
    .default([]),
});

// 2. Update Draft Handover Schema
const updateDraftHandoverSchema = z.object({
  shiftDate: z.coerce.date().optional(),
  shiftType: z.enum(SHIFT_TYPES).optional(),
  shiftLabel: z.string().trim().min(2).max(100).optional(),
  incomingOperatorId: z
    .string()
    .trim()
    .regex(objectIdRegex)
    .optional()
    .nullable(),
  outgoingRemarks: z.string().trim().max(2000).optional(),
  selectedIncidents: z
    .array(
      z.object({
        alertId: z.string().regex(objectIdRegex),
        flaggedForFollowUp: z.boolean().optional().default(false),
        notes: z.string().trim().max(500).optional().default(''),
      })
    )
    .optional(),
  manualNotes: z
    .array(
      z.object({
        category: z.enum(NOTE_CATEGORIES).default('GENERAL'),
        note: z.string().trim().min(2).max(1000),
        priority: z.enum(PRIORITIES).default('MEDIUM'),
      })
    )
    .optional(),
});

// 3. Submit Handover Schema
const submitHandoverSchema = z.object({
  outgoingRemarks: z.string().trim().max(2000).optional(),
});

// 4. Acknowledge Handover Schema
const acknowledgeHandoverSchema = z.object({
  remarks: z.string().trim().max(1000).optional().default(''),
});

// 5. Create Follow-Up Item Schema
const createFollowUpSchema = z.object({
  description: z.string().trim().min(3, 'Description must be at least 3 characters').max(500),
  relatedAlertCode: z.string().trim().toUpperCase().optional().nullable(),
  priority: z.enum(PRIORITIES).optional().default('MEDIUM'),
  assignedTo: z
    .string()
    .trim()
    .regex(objectIdRegex, 'Invalid assigned user ObjectId')
    .optional()
    .nullable(),
  remarks: z.string().trim().max(1000).optional().default(''),
});

// 6. Update Follow-Up Item Schema
const updateFollowUpSchema = z.object({
  status: z.enum(FOLLOWUP_STATUSES, {
    errorMap: () => ({ message: 'Status must be OPEN, IN_PROGRESS, COMPLETED, or BLOCKED' }),
  }),
  remarks: z.string().trim().max(1000).optional(),
});

// 7. Cancel Handover Schema
const cancelHandoverSchema = z.object({
  cancellationReason: z
    .string()
    .trim()
    .min(3, 'Cancellation reason must be at least 3 characters')
    .max(500),
});

// 8. Handover List & History Query Schema
const handoverQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.preprocess((val) => {
    if (val === undefined || val === '') return 10;
    const parsed = parseInt(String(val), 10);
    if (isNaN(parsed) || parsed < 1) return 10;
    return Math.min(parsed, 50);
  }, z.number().int().min(1).max(50).default(10)),
  status: z
    .preprocess((v) => (v ? String(v).toUpperCase() : 'ALL'), z.enum(['ALL', ...HANDOVER_STATUSES]))
    .optional()
    .default('ALL'),
  shiftType: z
    .preprocess((v) => (v ? String(v).toUpperCase() : 'ALL'), z.enum(['ALL', ...SHIFT_TYPES]))
    .optional()
    .default('ALL'),
  search: z.string().trim().max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'shiftDate', 'submittedAt']).optional().default('createdAt'),
  sortOrder: z.preprocess((v) => (String(v).toLowerCase() === 'asc' ? 1 : -1), z.number().int()).default(-1),
});

module.exports = {
  escapeRegex,
  objectIdRegex,
  createHandoverSchema,
  updateDraftHandoverSchema,
  submitHandoverSchema,
  acknowledgeHandoverSchema,
  createFollowUpSchema,
  updateFollowUpSchema,
  cancelHandoverSchema,
  handoverQuerySchema,
  SHIFT_TYPES,
  HANDOVER_STATUSES,
  FOLLOWUP_STATUSES,
  PRIORITIES,
  NOTE_CATEGORIES,
};

