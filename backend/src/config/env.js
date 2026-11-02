const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
    MONGODB_URI: z.string().min(1, { message: 'MONGODB_URI must not be empty' }).optional(),
    JWT_SECRET: z.string().min(16, { message: 'JWT_SECRET must be at least 16 characters' }).default('dev_jwt_secret_must_be_changed_in_env_file_12345'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    COOKIE_SECRET: z.string().min(16, { message: 'COOKIE_SECRET must be at least 16 characters' }).default('dev_cookie_secret_must_be_changed_12345'),
    CSRF_SECRET: z.string().min(16, { message: 'CSRF_SECRET must be at least 16 characters' }).default('dev_csrf_secret_must_be_changed_12345'),
    CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
    STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
    UPLOAD_DIR: z.string().default('./uploads'),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_FOLDER: z.string().default('ZEEX VSSP/Evidence'),
    KEEP_ALIVE_URL: z.string().url().optional().or(z.literal('')),
    KEEP_ALIVE_INTERVAL_MINUTES: z.string().transform((val) => parseInt(val, 10)).default('14'),
    RENDER_EXTERNAL_URL: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // In production or when STORAGE_DRIVER is cloudinary, require valid Cloudinary credentials
    const isCloudinaryRequired =
      data.STORAGE_DRIVER === 'cloudinary' ||
      (data.NODE_ENV === 'production' && data.STORAGE_DRIVER !== 'local');

    if (isCloudinaryRequired) {
      if (!data.CLOUDINARY_CLOUD_NAME || !data.CLOUDINARY_CLOUD_NAME.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDINARY_CLOUD_NAME'],
          message: 'CLOUDINARY_CLOUD_NAME is required when STORAGE_DRIVER is cloudinary or in production',
        });
      }
      if (!data.CLOUDINARY_API_KEY || !data.CLOUDINARY_API_KEY.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDINARY_API_KEY'],
          message: 'CLOUDINARY_API_KEY is required when STORAGE_DRIVER is cloudinary or in production',
        });
      }
      if (!data.CLOUDINARY_API_SECRET || !data.CLOUDINARY_API_SECRET.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDINARY_API_SECRET'],
          message: 'CLOUDINARY_API_SECRET is required when STORAGE_DRIVER is cloudinary or in production',
        });
      }
    }
  });

let parsedEnv;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('CRITICAL: Environment variable validation failed:');
    error.issues.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  } else {
    console.error('CRITICAL: Unexpected environment loading error:', error);
  }
  process.exit(1);
}

module.exports = parsedEnv;

