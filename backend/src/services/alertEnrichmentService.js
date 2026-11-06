const mongoose = require('mongoose');
const WorkFront = require('../models/WorkFront');
const Camera = require('../models/Camera');

/**
 * Service to automatically resolve and enrich detection events with operational Work-Front context.
 * Adheres strictly to backend-derived relationships and never trusts client-supplied context.
 */
class AlertEnrichmentService {
  /**
   * Resolve operational context for an incoming detection event associated with a registered camera.
   *
   * @param {Object|string} camera - Camera document or ObjectId
   * @returns {Promise<{ isEnriched: boolean, context: Object|null, reason?: string }>}
   */
  async resolveContext(camera) {
    try {
      if (!camera) {
        return { isEnriched: false, context: null, reason: 'NO_CAMERA_PROVIDED' };
      }

      let cameraDoc = camera;

      // If only an ID was passed, fetch the camera
      if (typeof camera === 'string' || camera instanceof mongoose.Types.ObjectId) {
        cameraDoc = await Camera.findOne({ _id: camera, isActive: true });
        if (!cameraDoc) {
          return { isEnriched: false, context: null, reason: 'CAMERA_NOT_FOUND' };
        }
      }

      // 1. Check if camera has a workFront association
      if (!cameraDoc.workFront) {
        return {
          isEnriched: false,
          context: null,
          reason: 'CAMERA_UNASSIGNED',
        };
      }

      // 2. Fetch or inspect the associated Work-Front
      let workFrontDoc = null;
      if (
        typeof cameraDoc.workFront === 'object' &&
        cameraDoc.workFront._id &&
        cameraDoc.workFront.workFrontCode
      ) {
        // Already populated
        workFrontDoc = cameraDoc.workFront;
      } else {
        workFrontDoc = await WorkFront.findOne({
          _id: cameraDoc.workFront,
          isActive: true,
        });
      }

      // 3. Handle missing or inactive Work-Front reference safely
      if (!workFrontDoc || !workFrontDoc.isActive) {
        return {
          isEnriched: false,
          context: null,
          reason: 'WORKFRONT_NOT_FOUND_OR_INACTIVE',
        };
      }

      // 4. Eligibility check: Cameras assigned to COMPLETED work-fronts should not attach active context
      if (workFrontDoc.status === 'COMPLETED') {
        return {
          isEnriched: false,
          context: null,
          reason: 'WORKFRONT_COMPLETED',
        };
      }

      // 5. Construct immutable operational snapshot for the alert
      // Storing these explicit snapshot fields ensures historical integrity even if
      // the camera is relocated or the work-front is subsequently modified.
      const operationalContext = {
        workFront: workFrontDoc._id,
        workFrontCode: workFrontDoc.workFrontCode,
        workFrontName: workFrontDoc.name,
        zone: workFrontDoc.zone || cameraDoc.location,
        contractor: workFrontDoc.contractor,
        activityType: workFrontDoc.activityType || 'GENERAL_CONSTRUCTION',
        riskLevel: workFrontDoc.riskLevel || 'MEDIUM',
        shift: workFrontDoc.shift || 'GENERAL_24X7',
      };

      return {
        isEnriched: true,
        context: operationalContext,
      };
    } catch (error) {
      console.warn('[AlertEnrichmentService] Context resolution error:', error.message);
      // Fail gracefully: Do not block event ingestion due to enrichment lookup error
      return {
        isEnriched: false,
        context: null,
        reason: 'ENRICHMENT_LOOKUP_ERROR',
      };
    }
  }
}

module.exports = new AlertEnrichmentService();

