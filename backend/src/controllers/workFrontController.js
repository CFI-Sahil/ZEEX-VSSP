const mongoose = require('mongoose');
const WorkFront = require('../models/WorkFront');
const Camera = require('../models/Camera');
const AuditLog = require('../models/AuditLog');
const { sendSuccess, sendError } = require('../utils/response');
const {
  createWorkFrontSchema,
  updateWorkFrontSchema,
  updateStatusSchema,
  workFrontQuerySchema,
  assignCameraSchema,
  relocateCameraSchema,
} = require('../validators/workFrontValidator');
const { logAudit } = require('../utils/auditLogger');
const { maskEmail, maskPhone } = require('../services/notificationService');

// Helper to escape regex special characters
const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @route   GET /api/v1/work-fronts
 * @desc    List work-fronts with search, multi-filter, pagination, and KPI summary
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getWorkFronts = async (req, res, next) => {
  try {
    const parseResult = workFrontQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return sendError(res, 'Invalid query parameters', parseResult.error.issues, 400);
    }

    const { page, limit, search, status, site, contractor, riskLevel, activityType } =
      parseResult.data;
    const filter = { isActive: true };

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (riskLevel && riskLevel !== 'ALL') {
      filter.riskLevel = riskLevel;
    }

    if (activityType && activityType !== 'ALL') {
      filter.activityType = activityType;
    }

    if (site && site.trim()) {
      filter.site = new RegExp(escapeRegex(site.trim()), 'i');
    }

    if (contractor && contractor.trim()) {
      filter.contractor = new RegExp(escapeRegex(contractor.trim()), 'i');
    }

    if (search && search.trim() !== '') {
      const sanitized = escapeRegex(search.trim());
      const regex = new RegExp(sanitized, 'i');
      filter.$or = [
        { workFrontCode: regex },
        { name: regex },
        { site: regex },
        { zone: regex },
        { contractor: regex },
        { 'supervisor.name': regex },
      ];
    }

    const skip = (page - 1) * limit;

    // Parallel query for list, count, and overall KPI metrics
    const [workFronts, total, kpiStats] = await Promise.all([
      WorkFront.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('cameras', 'cameraCode name site location status'),
      WorkFront.countDocuments(filter),
      WorkFront.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalWorkFronts: { $sum: 1 },
            activeWorkFronts: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
            highRiskFronts: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$riskLevel', ['HIGH', 'CRITICAL']] },
                      { $ne: ['$status', 'COMPLETED'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            contractors: { $addToSet: '$contractor' },
            assignedCamerasCount: {
              $sum: { $size: { $ifNull: ['$cameras', []] } },
            },
          },
        },
      ]),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const summaryKPIs = kpiStats[0]
      ? {
          totalWorkFronts: kpiStats[0].totalWorkFronts,
          activeWorkFronts: kpiStats[0].activeWorkFronts,
          highRiskFronts: kpiStats[0].highRiskFronts,
          activeContractors: kpiStats[0].contractors.filter(Boolean).length,
          assignedCamerasCount: kpiStats[0].assignedCamerasCount,
        }
      : {
          totalWorkFronts: 0,
          activeWorkFronts: 0,
          highRiskFronts: 0,
          activeContractors: 0,
          assignedCamerasCount: 0,
        };

    const sanitizedWorkFronts = workFronts.map((wf) => {
      const doc = wf.toObject ? wf.toObject() : { ...wf };
      if (doc.supervisor) {
        doc.supervisor = {
          ...doc.supervisor,
          phone: maskPhone(doc.supervisor.phone),
          email: maskEmail(doc.supervisor.email),
        };
      }
      return doc;
    });

    return sendSuccess(
      res,
      'Work-fronts retrieved successfully',
      {
        workFronts: sanitizedWorkFronts,
        kpis: summaryKPIs,
      },
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
 * @route   GET /api/v1/work-fronts/:id
 * @desc    Get detailed work-front record with populated cameras and audit history
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getWorkFrontById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid work-front identifier format', null, 400);
    }

    const workFront = await WorkFront.findOne({ _id: id, isActive: true }).populate(
      'cameras',
      'cameraCode name site location status streamStatus lastSeenAt'
    );

    if (!workFront) {
      return sendError(res, 'Work-front record not found', null, 404);
    }

    // Retrieve associated audit trail
    const auditLogs = await AuditLog.find({
      entityType: 'WORKFRONT',
      entityId: String(workFront._id),
    }).sort({ timestamp: -1 });

    return sendSuccess(res, 'Work-front details retrieved successfully', {
      workFront,
      auditLogs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/work-fronts
 * @desc    Register a new work-front (Admin only)
 * @access  Protected (ADMIN)
 */
const createWorkFront = async (req, res, next) => {
  try {
    const parseResult = createWorkFrontSchema.safeParse(req.body);
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

    const {
      workFrontCode,
      name,
      site,
      zone,
      contractor,
      supervisor,
      activityType,
      riskLevel,
      shift,
      status,
      startDate,
      endDate,
      description,
    } = parseResult.data;

    // Check for duplicate workFrontCode
    const existing = await WorkFront.findOne({
      workFrontCode: workFrontCode.toUpperCase(),
    });

    if (existing) {
      return sendError(
        res,
        'Duplicate work-front identifier',
        [
          {
            field: 'workFrontCode',
            message: `Work-front code '${workFrontCode.toUpperCase()}' is already registered`,
          },
        ],
        400
      );
    }

    const workFront = await WorkFront.create({
      workFrontCode: workFrontCode.toUpperCase(),
      name,
      site,
      zone,
      contractor,
      supervisor,
      activityType,
      riskLevel,
      shift,
      status: status || 'ACTIVE',
      cameras: [], // Camera assignment is explicitly scoped for Batch 2
      startDate: startDate || new Date(),
      endDate: endDate || null,
      description: description || '',
      isActive: true,
    });

    // Record audit event
    await logAudit({
      action: 'WORKFRONT_CREATED',
      entityType: 'WORKFRONT',
      entityId: workFront._id,
      req,
      details: {
        workFrontCode: workFront.workFrontCode,
        name: workFront.name,
        site: workFront.site,
        zone: workFront.zone,
        contractor: workFront.contractor,
        activityType: workFront.activityType,
        riskLevel: workFront.riskLevel,
        status: workFront.status,
      },
    });

    return sendSuccess(
      res,
      'Work-front registered successfully',
      { workFront },
      null,
      201
    );
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        'Duplicate work-front identifier',
        [
          {
            field: 'workFrontCode',
            message: 'Work-front code is already registered',
          },
        ],
        400
      );
    }
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/work-fronts/:id
 * @desc    Update work-front metadata (Admin only)
 * @access  Protected (ADMIN)
 */
const updateWorkFront = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid work-front identifier format', null, 400);
    }

    const parseResult = updateWorkFrontSchema.safeParse(req.body);
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

    const workFront = await WorkFront.findOne({ _id: id, isActive: true });
    if (!workFront) {
      return sendError(res, 'Work-front record not found', null, 404);
    }

    const updates = parseResult.data;
    const previousSnapshot = {
      name: workFront.name,
      site: workFront.site,
      zone: workFront.zone,
      contractor: workFront.contractor,
      activityType: workFront.activityType,
      riskLevel: workFront.riskLevel,
      status: workFront.status,
    };

    // Apply allowed updates
    if (updates.name !== undefined) workFront.name = updates.name;
    if (updates.site !== undefined) workFront.site = updates.site;
    if (updates.zone !== undefined) workFront.zone = updates.zone;
    if (updates.contractor !== undefined) workFront.contractor = updates.contractor;
    if (updates.supervisor) {
      workFront.supervisor = {
        name: updates.supervisor.name || workFront.supervisor.name,
        phone: updates.supervisor.phone !== undefined ? updates.supervisor.phone : workFront.supervisor.phone,
        email: updates.supervisor.email !== undefined ? updates.supervisor.email : workFront.supervisor.email,
      };
    }
    if (updates.activityType !== undefined) workFront.activityType = updates.activityType;
    if (updates.riskLevel !== undefined) workFront.riskLevel = updates.riskLevel;
    if (updates.shift !== undefined) workFront.shift = updates.shift;
    if (updates.status !== undefined) workFront.status = updates.status;
    if (updates.startDate !== undefined) workFront.startDate = updates.startDate;
    if (updates.endDate !== undefined) workFront.endDate = updates.endDate;
    if (updates.description !== undefined) workFront.description = updates.description;

    await workFront.save();

    // Record audit event
    await logAudit({
      action: 'WORKFRONT_UPDATED',
      entityType: 'WORKFRONT',
      entityId: workFront._id,
      req,
      details: {
        workFrontCode: workFront.workFrontCode,
        previous: previousSnapshot,
        updated: updates,
      },
    });

    return sendSuccess(res, 'Work-front updated successfully', { workFront });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/work-fronts/:id/status
 * @desc    Transition work-front lifecycle status (Admin only)
 * @access  Protected (ADMIN)
 */
const updateWorkFrontStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid work-front identifier format', null, 400);
    }

    const parseResult = updateStatusSchema.safeParse(req.body);
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

    const { status: newStatus, remarks } = parseResult.data;

    const workFront = await WorkFront.findOne({ _id: id, isActive: true });
    if (!workFront) {
      return sendError(res, 'Work-front record not found', null, 404);
    }

    const previousStatus = workFront.status;

    // Strict state transition validation:
    // Once COMPLETED, work-front cannot transition directly back to PLANNING
    if (previousStatus === 'COMPLETED' && newStatus === 'PLANNING') {
      return sendError(
        res,
        'Invalid status transition: A COMPLETED work-front cannot revert to PLANNING. Only ACTIVE or SUSPENDED are permitted upon resumption.',
        [
          {
            field: 'status',
            message: `Transition from ${previousStatus} to ${newStatus} is prohibited`,
          },
        ],
        400
      );
    }

    workFront.status = newStatus;
    await workFront.save();

    // Record audit event
    await logAudit({
      action: 'WORKFRONT_STATUS_CHANGED',
      entityType: 'WORKFRONT',
      entityId: workFront._id,
      req,
      details: {
        workFrontCode: workFront.workFrontCode,
        previousStatus,
        newStatus,
        remarks: remarks || '',
      },
    });

    return sendSuccess(
      res,
      `Work-front status updated to '${newStatus}'`,
      { workFront }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/work-fronts/:id/cameras/assign
 * @desc    Assign an unassigned camera to an eligible work-front (Admin only)
 * @access  Protected (ADMIN)
 */
const assignCameraToWorkFront = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid work-front identifier format', null, 400);
    }

    const parseResult = assignCameraSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(
        res,
        'Validation failed: Camera ID is required',
        parseResult.error.issues,
        400
      );
    }

    const { cameraId } = parseResult.data;
    if (!mongoose.Types.ObjectId.isValid(cameraId)) {
      return sendError(res, 'Invalid camera identifier format', null, 400);
    }

    const workFront = await WorkFront.findOne({ _id: id, isActive: true });
    if (!workFront) {
      return sendError(res, 'Work-front record not found', null, 404);
    }

    // Eligibility Rule: A camera cannot be assigned to a Work-Front with status COMPLETED
    if (workFront.status === 'COMPLETED') {
      return sendError(
        res,
        'Cannot assign camera: Work-front is COMPLETED. Camera assignments are prohibited on completed work-fronts.',
        [{ field: 'status', message: 'Work-front status is COMPLETED' }],
        400
      );
    }

    const camera = await Camera.findOne({ _id: cameraId, isActive: true });
    if (!camera) {
      return sendError(res, 'Camera record not found', null, 404);
    }

    // Exclusive Assignment Rule: A camera can be assigned to only ONE Work-Front at a time
    if (camera.workFront) {
      if (camera.workFront.toString() === workFront._id.toString()) {
        return sendError(
          res,
          `Camera '${camera.cameraCode}' is already assigned to this work-front.`,
          [{ field: 'cameraId', message: 'Camera is already assigned to this work-front' }],
          400
        );
      } else {
        const existingWF = await WorkFront.findById(camera.workFront).select('workFrontCode name');
        const wfCode = existingWF ? existingWF.workFrontCode : 'another work-front';
        return sendError(
          res,
          `Camera '${camera.cameraCode}' is already assigned to Work-Front '${wfCode}'. A camera can only be assigned to one Work-Front at a time. Please use the camera relocation workflow to move it.`,
          [{ field: 'cameraId', message: `Camera already assigned to ${wfCode}` }],
          400
        );
      }
    }

    // Maintain two-way relationship
    await WorkFront.updateOne(
      { _id: workFront._id },
      { $addToSet: { cameras: camera._id } }
    );
    await Camera.updateOne(
      { _id: camera._id },
      { $set: { workFront: workFront._id } }
    );

    // Record audit event
    await logAudit({
      action: 'CAMERA_ASSIGNED_TO_WORKFRONT',
      entityType: 'WORKFRONT',
      entityId: workFront._id,
      req,
      details: {
        cameraId: camera._id,
        cameraCode: camera.cameraCode,
        cameraName: camera.name,
        workFrontId: workFront._id,
        workFrontCode: workFront.workFrontCode,
        workFrontName: workFront.name,
      },
    });

    const updatedWorkFront = await WorkFront.findById(workFront._id).populate(
      'cameras',
      'cameraCode name site location status streamStatus'
    );

    return sendSuccess(
      res,
      `Camera '${camera.cameraCode}' assigned to work-front '${workFront.workFrontCode}' successfully`,
      { workFront: updatedWorkFront }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/work-fronts/:id/cameras/:cameraId
 * @desc    Remove an assigned camera from a work-front (Admin only)
 * @access  Protected (ADMIN)
 */
const removeCameraFromWorkFront = async (req, res, next) => {
  try {
    const { id, cameraId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(cameraId)) {
      return sendError(res, 'Invalid identifier format', null, 400);
    }

    const workFront = await WorkFront.findOne({ _id: id, isActive: true });
    if (!workFront) {
      return sendError(res, 'Work-front record not found', null, 404);
    }

    const camera = await Camera.findOne({ _id: cameraId, isActive: true });
    if (!camera) {
      return sendError(res, 'Camera record not found', null, 404);
    }

    // Verify camera is actually assigned to this work-front
    const isAssigned =
      camera.workFront && camera.workFront.toString() === workFront._id.toString();
    const isInArray = workFront.cameras.some((c) => c.toString() === camera._id.toString());

    if (!isAssigned && !isInArray) {
      return sendError(
        res,
        `Camera '${camera.cameraCode}' is not currently assigned to work-front '${workFront.workFrontCode}'`,
        [{ field: 'cameraId', message: 'Camera is not assigned to this work-front' }],
        400
      );
    }

    // Remove relationship on both sides (Leaves camera record completely intact)
    await WorkFront.updateOne(
      { _id: workFront._id },
      { $pull: { cameras: camera._id } }
    );
    await Camera.updateOne(
      { _id: camera._id },
      { $set: { workFront: null } }
    );

    // Record audit event
    await logAudit({
      action: 'CAMERA_REMOVED_FROM_WORKFRONT',
      entityType: 'WORKFRONT',
      entityId: workFront._id,
      req,
      details: {
        cameraId: camera._id,
        cameraCode: camera.cameraCode,
        workFrontId: workFront._id,
        workFrontCode: workFront.workFrontCode,
      },
    });

    const updatedWorkFront = await WorkFront.findById(workFront._id).populate(
      'cameras',
      'cameraCode name site location status streamStatus'
    );

    return sendSuccess(
      res,
      `Camera '${camera.cameraCode}' removed from work-front '${workFront.workFrontCode}' successfully`,
      { workFront: updatedWorkFront }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/work-fronts/:id/cameras/relocate
 * @desc    Relocate an assigned camera from source work-front to destination work-front (Admin only)
 * @access  Protected (ADMIN)
 */
const relocateCamera = async (req, res, next) => {
  try {
    const { id: sourceWorkFrontId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sourceWorkFrontId)) {
      return sendError(res, 'Invalid source work-front identifier format', null, 400);
    }

    const parseResult = relocateCameraSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(
        res,
        'Validation failed for camera relocation',
        parseResult.error.issues,
        400
      );
    }

    const { cameraId, destinationWorkFrontId, reason } = parseResult.data;

    if (
      !mongoose.Types.ObjectId.isValid(cameraId) ||
      !mongoose.Types.ObjectId.isValid(destinationWorkFrontId)
    ) {
      return sendError(res, 'Invalid identifier format in relocation payload', null, 400);
    }

    if (sourceWorkFrontId === destinationWorkFrontId) {
      return sendError(
        res,
        'Source and destination work-fronts cannot be the same',
        [{ field: 'destinationWorkFrontId', message: 'Destination must be different from source' }],
        400
      );
    }

    const [sourceWorkFront, destWorkFront, camera] = await Promise.all([
      WorkFront.findOne({ _id: sourceWorkFrontId, isActive: true }),
      WorkFront.findOne({ _id: destinationWorkFrontId, isActive: true }),
      Camera.findOne({ _id: cameraId, isActive: true }),
    ]);

    if (!sourceWorkFront) {
      return sendError(res, 'Source work-front record not found', null, 404);
    }

    if (!destWorkFront) {
      return sendError(res, 'Destination work-front record not found', null, 404);
    }

    // Eligibility Rule: A camera cannot be assigned to a Work-Front with status COMPLETED
    if (destWorkFront.status === 'COMPLETED') {
      return sendError(
        res,
        'Cannot relocate camera: Destination work-front is COMPLETED. Camera assignments to completed fronts are prohibited.',
        [{ field: 'destinationWorkFrontId', message: 'Destination work-front status is COMPLETED' }],
        400
      );
    }

    if (!camera) {
      return sendError(res, 'Camera record not found', null, 404);
    }

    // Validate that camera is currently assigned to the stated source Work-Front
    const isAssignedToSource =
      camera.workFront && camera.workFront.toString() === sourceWorkFront._id.toString();

    if (!isAssignedToSource) {
      return sendError(
        res,
        `Camera '${camera.cameraCode}' is not currently assigned to source work-front '${sourceWorkFront.workFrontCode}'. It cannot be relocated from an unassociated work-front.`,
        [{ field: 'cameraId', message: 'Camera is not assigned to the stated source work-front' }],
        400
      );
    }

    // Execute atomic relocation
    // Try MongoDB session transaction first; if environment does not support sessions, fall back to sequential rollback
    let session = null;
    let useTransaction = false;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (_) {
      useTransaction = false;
    }

    try {
      if (useTransaction && session) {
        // 1. Remove from source
        await WorkFront.updateOne(
          { _id: sourceWorkFront._id },
          { $pull: { cameras: camera._id } },
          { session }
        );
        // 2. Add to destination
        await WorkFront.updateOne(
          { _id: destWorkFront._id },
          { $addToSet: { cameras: camera._id } },
          { session }
        );
        // 3. Update camera reference
        await Camera.updateOne(
          { _id: camera._id },
          { $set: { workFront: destWorkFront._id } },
          { session }
        );
        await session.commitTransaction();
      } else {
        // Safe sequential updates with compensation rollback
        await WorkFront.updateOne({ _id: sourceWorkFront._id }, { $pull: { cameras: camera._id } });
        try {
          await WorkFront.updateOne({ _id: destWorkFront._id }, { $addToSet: { cameras: camera._id } });
          await Camera.updateOne({ _id: camera._id }, { $set: { workFront: destWorkFront._id } });
        } catch (innerErr) {
          // Compensate rollback to restore source association
          await WorkFront.updateOne({ _id: sourceWorkFront._id }, { $addToSet: { cameras: camera._id } });
          await WorkFront.updateOne({ _id: destWorkFront._id }, { $pull: { cameras: camera._id } });
          await Camera.updateOne({ _id: camera._id }, { $set: { workFront: sourceWorkFront._id } });
          throw innerErr;
        }
      }
    } catch (txErr) {
      if (useTransaction && session) {
        await session.abortTransaction();
      }
      throw txErr;
    } finally {
      if (session) {
        session.endSession();
      }
    }

    // Record audit event
    await logAudit({
      action: 'CAMERA_RELOCATED',
      entityType: 'CAMERA',
      entityId: camera._id,
      req,
      details: {
        cameraId: camera._id,
        cameraCode: camera.cameraCode,
        cameraName: camera.name,
        sourceWorkFrontId: sourceWorkFront._id,
        sourceWorkFrontCode: sourceWorkFront.workFrontCode,
        destinationWorkFrontId: destWorkFront._id,
        destinationWorkFrontCode: destWorkFront.workFrontCode,
        reason: reason || '',
      },
    });

    const [updatedSource, updatedDest, updatedCamera] = await Promise.all([
      WorkFront.findById(sourceWorkFront._id).populate('cameras', 'cameraCode name site location status'),
      WorkFront.findById(destWorkFront._id).populate('cameras', 'cameraCode name site location status'),
      Camera.findById(camera._id).populate('workFront', 'workFrontCode name site zone contractor status'),
    ]);

    return sendSuccess(
      res,
      `Camera '${camera.cameraCode}' relocated from '${sourceWorkFront.workFrontCode}' to '${destWorkFront.workFrontCode}' successfully`,
      {
        camera: updatedCamera,
        sourceWorkFront: updatedSource,
        destinationWorkFront: updatedDest,
      }
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkFronts,
  getWorkFrontById,
  createWorkFront,
  updateWorkFront,
  updateWorkFrontStatus,
  assignCameraToWorkFront,
  removeCameraFromWorkFront,
  relocateCamera,
};

