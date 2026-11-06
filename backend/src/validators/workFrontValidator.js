const { z } = require('zod');

const ACTIVITY_TYPES = [
  'WORKING_AT_HEIGHT',
  'HOT_WORK',
  'EXCAVATION',
  'CONFINED_SPACE',
  'HEAVY_LIFTING',
  'ELECTRICAL',
  'GENERAL_CONSTRUCTION',
  'OTHER',
];

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT', 'GENERAL_24X7'];
const STATUSES = ['PLANNING', 'ACTIVE', 'SUSPENDED', 'COMPLETED'];

const supervisorSchema = z.object({
  name: z
    .string({ required_error: 'Supervisor name is required' })
    .trim()
    .min(2, 'Supervisor name must be at least 2 characters')
    .max(100, 'Supervisor name cannot exceed 100 characters'),
  phone: z
    .string()
    .trim()
    .max(30, 'Phone number cannot exceed 30 characters')
    .optional()
    .default(''),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address')
    .or(z.literal(''))
    .optional()
    .default(''),
});

const createWorkFrontSchema = z.object({
  workFrontCode: z
    .string({ required_error: 'Work-front identifier code is required' })
    .trim()
    .toUpperCase()
    .min(2, 'Work-front code must be at least 2 characters')
    .max(30, 'Work-front code cannot exceed 30 characters')
    .regex(
      /^[A-Z0-9_-]+$/,
      'Work-front code must contain only uppercase letters, numbers, hyphens, or underscores'
    ),
  name: z
    .string({ required_error: 'Work-front name is required' })
    .trim()
    .min(2, 'Work-front name must be at least 2 characters')
    .max(120, 'Work-front name cannot exceed 120 characters'),
  site: z
    .string({ required_error: 'Site location name is required' })
    .trim()
    .min(2, 'Site name must be at least 2 characters')
    .max(100, 'Site name cannot exceed 100 characters'),
  zone: z
    .string({ required_error: 'Zone or area location is required' })
    .trim()
    .min(2, 'Zone must be at least 2 characters')
    .max(100, 'Zone cannot exceed 100 characters'),
  contractor: z
    .string({ required_error: 'Responsible contractor is required' })
    .trim()
    .min(2, 'Contractor name must be at least 2 characters')
    .max(100, 'Contractor name cannot exceed 100 characters'),
  supervisor: supervisorSchema,
  activityType: z.enum(ACTIVITY_TYPES, {
    errorMap: () => ({ message: 'Invalid activity type category' }),
  }),
  riskLevel: z.enum(RISK_LEVELS, {
    errorMap: () => ({ message: 'Risk level must be LOW, MEDIUM, HIGH, or CRITICAL' }),
  }),
  shift: z.enum(SHIFTS, {
    errorMap: () => ({ message: 'Shift must be MORNING, AFTERNOON, NIGHT, or GENERAL_24X7' }),
  }),
  status: z
    .enum(STATUSES, {
      errorMap: () => ({ message: 'Status must be PLANNING, ACTIVE, SUSPENDED, or COMPLETED' }),
    })
    .default('ACTIVE'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .default(''),
});

const updateWorkFrontSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  site: z.string().trim().min(2).max(100).optional(),
  zone: z.string().trim().min(2).max(100).optional(),
  contractor: z.string().trim().min(2).max(100).optional(),
  supervisor: supervisorSchema.partial().optional(),
  activityType: z.enum(ACTIVITY_TYPES).optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  shift: z.enum(SHIFTS).optional(),
  status: z.enum(STATUSES).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  description: z.string().trim().max(500).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(STATUSES, {
    errorMap: () => ({ message: 'Status must be PLANNING, ACTIVE, SUSPENDED, or COMPLETED' }),
  }),
  remarks: z.string().trim().max(500).optional().default(''),
});

const normalizeEnumQuery = (allowedValues, defaultValue = 'ALL') =>
  z.preprocess((val) => {
    if (typeof val !== 'string') return defaultValue;
    const trimmed = val.trim().toUpperCase();
    return trimmed === '' ? defaultValue : trimmed;
  }, z.enum([...allowedValues, 'ALL']).default(defaultValue));

const workFrontQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  status: normalizeEnumQuery(STATUSES, 'ALL'),
  site: z.string().trim().optional(),
  contractor: z.string().trim().optional(),
  riskLevel: normalizeEnumQuery(RISK_LEVELS, 'ALL'),
  activityType: normalizeEnumQuery(ACTIVITY_TYPES, 'ALL'),
});

const assignCameraSchema = z.object({
  cameraId: z
    .string({ required_error: 'Camera identifier is required' })
    .trim()
    .min(1, 'Camera identifier cannot be empty'),
});

const relocateCameraSchema = z.object({
  cameraId: z
    .string({ required_error: 'Camera identifier is required' })
    .trim()
    .min(1, 'Camera identifier cannot be empty'),
  destinationWorkFrontId: z
    .string({ required_error: 'Destination work-front identifier is required' })
    .trim()
    .min(1, 'Destination work-front identifier cannot be empty'),
  reason: z.string().trim().max(300).optional().default(''),
});

module.exports = {
  ACTIVITY_TYPES,
  RISK_LEVELS,
  SHIFTS,
  STATUSES,
  createWorkFrontSchema,
  updateWorkFrontSchema,
  updateStatusSchema,
  workFrontQuerySchema,
  assignCameraSchema,
  relocateCameraSchema,
};

