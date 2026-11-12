const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');

async function runReadOnlyAudit() {
  console.log('=== STRICT READ-ONLY DATABASE AUDIT & RECONCILIATION ===');
  
  await connectDB();
  const db = mongoose.connection.db;

  // 1. Audit Alerts
  console.log('\n--- 1. ALERT COLLECTION AUDIT ---');
  const alertCol = db.collection('alerts');
  const totalAlerts = await alertCol.countDocuments();
  console.log('Total Alerts:', totalAlerts);

  const statusAgg = await alertCol.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  console.log('Status Distribution:', statusAgg);

  const allAlerts = await alertCol.find({}, {
    projection: { _id: 1, alertCode: 1, status: 1, ruleId: 1, severity: 1, detectedAt: 1, createdAt: 1, 'metadata.source': 1, 'metadata.evidenceIntent': 1, title: 1 }
  }).sort({ createdAt: 1 }).toArray();

  console.log(`Fetched all ${allAlerts.length} alerts.`);

  // Group by date of creation
  const byDate = {};
  for (const a of allAlerts) {
    const dStr = (a.createdAt ? a.createdAt.toISOString() : 'NO_CREATED_AT').substring(0, 10);
    if (!byDate[dStr]) byDate[dStr] = [];
    byDate[dStr].push(a);
  }

  console.log('\nAlerts by creation date:');
  for (const [date, list] of Object.entries(byDate)) {
    const statuses = list.reduce((acc, x) => { acc[x.status] = (acc[x.status] || 0) + 1; return acc; }, {});
    console.log(`Date: ${date} | Count: ${list.length} | Statuses:`, statuses);
  }

  // Baseline alerts (Nov 8)
  const nov8Alerts = byDate['2026-11-08'] || [];
  console.log(`\nNov 8 Alerts count: ${nov8Alerts.length}`);
  const nov8Statuses = nov8Alerts.reduce((acc, x) => { acc[x.status] = (acc[x.status] || 0) + 1; return acc; }, {});
  console.log('Nov 8 Statuses:', nov8Statuses);

  // Group Nov 8 alerts by ruleId and status
  const nov8Rules = nov8Alerts.reduce((acc, x) => {
    acc[x.ruleId] = acc[x.ruleId] || { total: 0, pending: 0, ack: 0, closed: 0 };
    acc[x.ruleId].total++;
    if (x.status === 'PENDING') acc[x.ruleId].pending++;
    if (x.status === 'ACKNOWLEDGED') acc[x.ruleId].ack++;
    if (x.status === 'CLOSED') acc[x.ruleId].closed++;
    return acc;
  }, {});
  console.log('Nov 8 Breakdown by Rule:', nov8Rules);

  // Examine alerts from Nov 9 onwards
  const postNov8 = allAlerts.filter(a => (a.createdAt ? a.createdAt.toISOString() : '').substring(0, 10) !== '2026-11-08');
  console.log(`\nPost-Nov 8 Alerts count: ${postNov8.length}`);
  postNov8.forEach((a, i) => {
    console.log(`  [${i + 1}] Code: ${a.alertCode} | Status: ${a.status} | Rule: ${a.ruleId} | Title: ${a.title} | Created: ${a.createdAt ? a.createdAt.toISOString() : 'N/A'}`);
  });

  // 2. Audit DetectionEvents
  console.log('\n--- 2. DETECTION EVENT AUDIT ---');
  const eventCol = db.collection('detectionevents');
  const totalEvents = await eventCol.countDocuments();
  console.log('Total DetectionEvents:', totalEvents);

  const eventStatusAgg = await eventCol.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  console.log('DetectionEvent Status Distribution:', eventStatusAgg);

  const allEvents = await eventCol.find({}, {
    projection: { _id: 1, eventId: 1, status: 1, ruleId: 1, cameraCode: 1, rejectionReason: 1, createdAt: 1, source: 1 }
  }).sort({ createdAt: 1 }).toArray();

  console.log(`Total events retrieved: ${allEvents.length}`);
  const eventsByDate = {};
  for (const e of allEvents) {
    const dStr = (e.createdAt ? e.createdAt.toISOString() : 'NO_CREATED_AT').substring(0, 10);
    if (!eventsByDate[dStr]) eventsByDate[dStr] = [];
    eventsByDate[dStr].push(e);
  }
  for (const [date, list] of Object.entries(eventsByDate)) {
    const statuses = list.reduce((acc, x) => { acc[x.status] = (acc[x.status] || 0) + 1; return acc; }, {});
    console.log(`Date: ${date} | Count: ${list.length} | Statuses:`, statuses);
  }

  const rejectedEvents = allEvents.filter(e => e.status === 'REJECTED');
  console.log(`\nRejected Events count: ${rejectedEvents.length}`);
  rejectedEvents.forEach((e, i) => {
    console.log(`  [${i + 1}] EventId: ${e.eventId} | Reason: ${e.rejectionReason} | Created: ${e.createdAt ? e.createdAt.toISOString() : 'N/A'}`);
  });

  // 3. Audit AuditLogs
  console.log('\n--- 3. AUDIT LOG AUDIT ---');
  const auditCol = db.collection('auditlogs');
  const totalAuditLogs = await auditCol.countDocuments();
  console.log('Total AuditLogs:', totalAuditLogs);

  const auditActions = await auditCol.aggregate([
    { $group: { _id: '$action', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('Audit Actions (Top 15):', auditActions.slice(0, 15));

  // Check for any delete operations in audit logs
  const deleteAuditLogs = await auditCol.find({
    action: { $regex: /delete|remove|purge|clean/i }
  }).toArray();
  console.log('AuditLogs mentioning delete/remove/purge/clean:', deleteAuditLogs.length);
  deleteAuditLogs.forEach(d => {
    console.log(`  Action: ${d.action} | Entity: ${d.entityType || d.targetCollection} | Timestamp: ${d.timestamp || d.createdAt}`);
  });

  // 4. Other Collections
  console.log('\n--- 4. OTHER COLLECTIONS SUMMARY ---');
  const collections = ['evidence', 'cameras', 'workfronts', 'shifthandovers', 'handoveractivities', 'trainingscenarios', 'trainingsessions', 'trainingactivities', 'users', 'notificationlogs'];
  for (const c of collections) {
    const col = db.collection(c);
    const count = await col.countDocuments();
    console.log(`Collection [${c}]: ${count} documents`);
  }

  await disconnectDB();
  console.log('\n=== AUDIT COMPLETE ===');
}

runReadOnlyAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
