/**
 * Deterministic Training Evaluation & Scoring Engine
 * Pure backend scoring for simulated safety incidents.
 * Evaluates operator actions against scenario-defined criteria.
 */

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Calculates deterministic evaluation score and feedback
 * @param {Object} expected - Scenario expected evaluation criteria & weights
 * @param {Object} assessment - Operator's submitted assessment
 * @param {Object} simulatedAlert - State of the simulated alert (acknowledgment, remarks)
 * @returns {Object} Evaluation result with score breakdown, feedback, and performance band
 */
const evaluateSession = ({ expected, assessment = {}, simulatedAlert = {} }) => {
  const weights = {
    violationId: expected.weights?.violationId ?? 20,
    severity: expected.weights?.severity ?? 20,
    acknowledgment: expected.weights?.acknowledgment ?? 15,
    immediateResponse: expected.weights?.immediateResponse ?? 15,
    correctiveAction: expected.weights?.correctiveAction ?? 20,
    resolutionRemarks: expected.weights?.resolutionRemarks ?? 10,
  };

  const scoreBreakdown = {
    violationScore: 0,
    severityScore: 0,
    ackScore: 0,
    responseScore: 0,
    correctiveScore: 0,
    remarksScore: 0,
  };

  const feedback = [];
  const missedCriteria = [];

  // 1. Violation Identification (default 20 points)
  const assessedViolation = assessment.assessedViolationType?.trim()?.toUpperCase();
  const expectedViolation = expected.expectedViolationType?.trim()?.toUpperCase();

  if (assessedViolation && assessedViolation === expectedViolation) {
    scoreBreakdown.violationScore = weights.violationId;
    feedback.push(`Correctly identified violation category as ${expectedViolation}.`);
  } else {
    scoreBreakdown.violationScore = 0;
    missedCriteria.push(
      `Incorrect violation identification. Assessed: ${assessedViolation || 'None'}, Expected: ${expectedViolation}.`
    );
  }

  // 2. Severity Assessment (default 20 points)
  const assessedSeverity = assessment.assessedSeverity?.trim()?.toUpperCase();
  const expectedSeverity = expected.expectedSeverity?.trim()?.toUpperCase();

  if (assessedSeverity && assessedSeverity === expectedSeverity) {
    scoreBreakdown.severityScore = weights.severity;
    feedback.push(`Accurately evaluated severity level as ${expectedSeverity}.`);
  } else {
    const assessedIdx = SEVERITY_LEVELS.indexOf(assessedSeverity);
    const expectedIdx = SEVERITY_LEVELS.indexOf(expectedSeverity);

    if (assessedIdx !== -1 && expectedIdx !== -1 && Math.abs(assessedIdx - expectedIdx) === 1) {
      // 50% partial credit for 1-step difference (e.g., HIGH vs CRITICAL)
      const partial = Math.round(weights.severity * 0.5);
      scoreBreakdown.severityScore = partial;
      feedback.push(`Severity assessment was close (${assessedSeverity}), awarded partial credit (${partial}/${weights.severity} pts).`);
      missedCriteria.push(`Assessed severity ${assessedSeverity} deviates slightly from benchmark ${expectedSeverity}.`);
    } else {
      scoreBreakdown.severityScore = 0;
      missedCriteria.push(
        `Severity assessment ${assessedSeverity || 'None'} failed to match benchmark ${expectedSeverity}.`
      );
    }
  }

  // 3. Incident Acknowledgment (default 15 points)
  if (simulatedAlert.acknowledgedAt) {
    scoreBreakdown.ackScore = weights.acknowledgment;
    feedback.push('Timely initial alert acknowledgment completed before incident resolution.');
  } else {
    scoreBreakdown.ackScore = 0;
    missedCriteria.push('Simulated incident was resolved without formal operational acknowledgment.');
  }

  // 4. Immediate Response Selection (default 15 points)
  const assessedResponse = assessment.selectedImmediateResponse?.trim()?.toUpperCase();
  const expectedResponse = expected.expectedImmediateResponse?.trim()?.toUpperCase();

  if (assessedResponse && assessedResponse === expectedResponse) {
    scoreBreakdown.responseScore = weights.immediateResponse;
    feedback.push(`Proper immediate response protocol selected: ${expectedResponse}.`);
  } else {
    scoreBreakdown.responseScore = 0;
    missedCriteria.push(
      `Immediate response '${assessedResponse || 'None'}' does not conform to required safety protocol '${expectedResponse}'.`
    );
  }

  // 5. Corrective Action Category & Quality (default 20 points)
  const assessedActionCat = assessment.correctiveActionCategory?.trim()?.toUpperCase();
  const expectedActionCat = expected.expectedCorrectiveActionCategory?.trim()?.toUpperCase();
  const actionRemarks = assessment.correctiveActionRemarks?.trim() || '';

  if (assessedActionCat && assessedActionCat === expectedActionCat) {
    if (actionRemarks.length >= 10) {
      scoreBreakdown.correctiveScore = weights.correctiveAction;
      feedback.push('Corrective action category and documentation appropriately address hazard root cause.');
    } else {
      const halfCredit = Math.round(weights.correctiveAction * 0.5);
      scoreBreakdown.correctiveScore = halfCredit;
      feedback.push('Corrective action category was correct, but notes lacked sufficient implementation detail.');
      missedCriteria.push('Corrective action remarks were brief (< 10 chars).');
    }
  } else {
    scoreBreakdown.correctiveScore = 0;
    missedCriteria.push(
      `Corrective action category '${assessedActionCat || 'None'}' does not meet expectation '${expectedActionCat}'.`
    );
  }

  // 6. Resolution Remarks and Incident Closure (default 10 points)
  const resRemarks = simulatedAlert.resolutionRemarks?.trim() || '';
  const minLength = expected.minimumRemarksLength || 15;

  if (resRemarks.length >= minLength) {
    scoreBreakdown.remarksScore = weights.resolutionRemarks;
    feedback.push('Comprehensive closure remarks provided during incident resolution.');
  } else if (resRemarks.length >= 5) {
    const halfCredit = Math.round(weights.resolutionRemarks * 0.5);
    scoreBreakdown.remarksScore = halfCredit;
    feedback.push(`Closure remarks met basic requirement but fell short of the recommended detail (${minLength} chars).`);
    missedCriteria.push(`Closure remarks length (${resRemarks.length} chars) was below target (${minLength} chars).`);
  } else {
    scoreBreakdown.remarksScore = 0;
    missedCriteria.push('Inadequate or missing closure remarks upon incident resolution.');
  }

  // Total Score Calculation
  const totalScore = Math.min(
    100,
    Math.max(
      0,
      scoreBreakdown.violationScore +
        scoreBreakdown.severityScore +
        scoreBreakdown.ackScore +
        scoreBreakdown.responseScore +
        scoreBreakdown.correctiveScore +
        scoreBreakdown.remarksScore
    )
  );

  let performanceBand = 'NEEDS_IMPROVEMENT';
  if (totalScore >= 85) {
    performanceBand = 'EXCELLENT';
  } else if (totalScore >= 70) {
    performanceBand = 'GOOD';
  }

  const passed = totalScore >= 70;

  return {
    totalScore,
    maxScore: 100,
    passed,
    performanceBand,
    scoreBreakdown,
    feedback,
    missedCriteria,
    evaluatedAt: new Date(),
  };
};

module.exports = {
  evaluateSession,
};

