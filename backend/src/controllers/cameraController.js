const mongoose = require('mongoose');
const Camera = require('../models/Camera');
const { sendSuccess, sendError } = require('../utils/response');
const {
  createCameraSchema,
  updateCameraSchema,
  cameraQuerySchema,
} = require('../validators/cameraValidator');

/**
 * Escapes special regex characters to prevent ReDoS / injection
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * @route   POST /api/v1/cameras
 * @desc    Register a new camera (Admin only)
 * @access  Protected (ADMIN)
 */
const createCamera = async (req, res, next) => {
  try {
    const parseResult = createCameraSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(
        res,
        'Validation failed',
        parseResult.error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        400
      );
    }

    const { cameraCode, name, site, location, description } = parseResult.data;

    // Check for duplicate cameraCode
    const existing = await Camera.findOne({ cameraCode });
    if (existing) {
      return sendError(
        res,
        'Duplicate camera identifier',
        [{ field: 'cameraCode', message: `Camera code '${cameraCode}' is already registered` }],
        400
      );
    }

    // New cameras strictly default to UNKNOWN with null lastSeenAt
    const camera = await Camera.create({
      cameraCode,
      name,
      site,
      location,
      description,
      status: 'UNKNOWN',
      streamStatus: 'UNAVAILABLE',
      lastSeenAt: null,
      isActive: true,
    });

    return sendSuccess(res, 'Camera registered successfully', { camera }, null, 201);
  } catch (error) {
    // Handle MongoDB unique index violation duplicate key error (code 11000)
    if (error.code === 11000) {
      return sendError(
        res,
        'Duplicate camera identifier',
        [{ field: 'cameraCode', message: 'Camera identifier is already registered' }],
        400
      );
    }
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/cameras/:id
 * @desc    Edit camera metadata (Admin only)
 * @access  Protected (ADMIN)
 */
const updateCamera = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid camera identifier format', null, 400);
    }

    const parseResult = updateCameraSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(
        res,
        'Validation failed',
        parseResult.error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        400
      );
    }

    const camera = await Camera.findOne({ _id: id, isActive: true });
    if (!camera) {
      return sendError(res, 'Camera record not found', null, 404);
    }

    const updates = parseResult.data;
    if (updates.name !== undefined) camera.name = updates.name;
    if (updates.site !== undefined) camera.site = updates.site;
    if (updates.location !== undefined) camera.location = updates.location;
    if (updates.description !== undefined) camera.description = updates.description;
    if (updates.status !== undefined) camera.status = updates.status;

    await camera.save();

    return sendSuccess(res, 'Camera updated successfully', { camera });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/cameras
 * @desc    List cameras with search, filter and pagination
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getCameras = async (req, res, next) => {
  try {
    const queryResult = cameraQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return sendError(res, 'Invalid query parameters', queryResult.error.issues, 400);
    }

    const { page, limit, search, status } = queryResult.data;
    const filter = { isActive: true };

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (search && search.trim() !== '') {
      const sanitizedSearch = escapeRegex(search.trim());
      const regex = new RegExp(sanitizedSearch, 'i');
      filter.$or = [{ cameraCode: regex }, { name: regex }, { location: regex }, { site: regex }];
    }

    const skip = (page - 1) * limit;

    const [cameras, total] = await Promise.all([
      Camera.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('workFront', 'workFrontCode name site zone contractor status'),
      Camera.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return sendSuccess(
      res,
      'Cameras retrieved successfully',
      { cameras },
      {
        page,
        limit,
        total,
        totalPages,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/cameras/available
 * @desc    Get cameras that are currently unassigned to any work-front
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getAvailableCameras = async (req, res, next) => {
  try {
    const availableCameras = await Camera.find({
      isActive: true,
      $or: [{ workFront: null }, { workFront: { $exists: false } }],
    })
      .sort({ cameraCode: 1 })
      .select('cameraCode name site location status streamStatus');

    return sendSuccess(res, 'Available cameras retrieved successfully', {
      cameras: availableCameras,
      count: availableCameras.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/cameras/:id
 * @desc    Get detailed camera record with populated work-front
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getCameraById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid camera identifier format', null, 400);
    }

    const camera = await Camera.findOne({ _id: id, isActive: true }).populate(
      'workFront',
      'workFrontCode name site zone contractor status supervisor'
    );
    if (!camera) {
      return sendError(res, 'Camera record not found', null, 404);
    }

    return sendSuccess(res, 'Camera details retrieved', { camera });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCamera,
  updateCamera,
  getCameras,
  getAvailableCameras,
  getCameraById,
};

