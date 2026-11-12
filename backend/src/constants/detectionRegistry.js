/**
 * VSSP Canonical Detection Registry
 * Single source of truth for supported safety violation definitions across all phases.
 */

const DETECTION_REGISTRY = {
  NO_HELMET: {
    code: 'NO_HELMET',
    name: 'Missing Safety Helmet',
    category: 'PPE',
    defaultSeverity: 'HIGH',
    description: 'Personnel detected within monitored perimeter without mandatory hard hat / safety helmet.',
    isActive: true,
  },
  NO_VEST: {
    code: 'NO_VEST',
    name: 'Missing High-Vis Vest',
    category: 'PPE',
    defaultSeverity: 'HIGH',
    description: 'Personnel detected without high-visibility reflective safety vest in designated work area.',
    isActive: true,
  },
  UNAUTHORIZED_ZONE: {
    code: 'UNAUTHORIZED_ZONE',
    name: 'Unauthorized Zone Entry',
    category: 'ZONE_RESTRICTION',
    defaultSeverity: 'MEDIUM',
    description: 'Personnel or vehicle entry detected into restricted, hazardous, or non-credentialed perimeter.',
    isActive: true,
  },
  NO_SAFETY_BOOTS: {
    code: 'NO_SAFETY_BOOTS',
    name: 'Missing Protective Footwear',
    category: 'PPE',
    defaultSeverity: 'HIGH',
    description: 'Personnel detected without mandated steel-toe or industrial protective footwear.',
    isActive: true,
  },
  RESTRICTED_ACCESS: {
    code: 'RESTRICTED_ACCESS',
    name: 'Restricted Facility Breach',
    category: 'ACCESS_CONTROL',
    defaultSeverity: 'CRITICAL',
    description: 'Severe boundary breach into locked, high-voltage, or confined industrial enclosure.',
    isActive: true,
  },
  OTHER: {
    code: 'OTHER',
    name: 'General Safety Non-Compliance',
    category: 'GENERAL',
    defaultSeverity: 'LOW',
    description: 'General occupational safety non-compliance requiring operator review.',
    isActive: true,
  },
};

const SUPPORTED_DETECTION_CODES = Object.keys(DETECTION_REGISTRY);

/**
 * Validates whether a detection code exists in the canonical registry
 * @param {string} code
 * @returns {boolean}
 */
const isValidDetectionCode = (code) => {
  if (!code || typeof code !== 'string') return false;
  return Boolean(DETECTION_REGISTRY[code.toUpperCase().trim()]);
};

/**
 * Retrieves the full metadata definition for a given detection code
 * @param {string} code
 * @returns {Object|null}
 */
const getDetectionDefinition = (code) => {
  if (!isValidDetectionCode(code)) return null;
  return DETECTION_REGISTRY[code.toUpperCase().trim()];
};

/**
 * Returns all active detection definitions in the registry
 * @returns {Array<Object>}
 */
const getAllSupportedDetections = () => {
  return Object.values(DETECTION_REGISTRY).filter((d) => d.isActive);
};

module.exports = {
  DETECTION_REGISTRY,
  SUPPORTED_DETECTION_CODES,
  isValidDetectionCode,
  getDetectionDefinition,
  getAllSupportedDetections,
};

