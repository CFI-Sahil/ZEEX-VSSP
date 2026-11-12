const crypto = require('crypto');
const NotificationLog = require('../models/NotificationLog');

const BACKOFF_SCHEDULE_MS = {
  1: 30 * 1000,  // Retry 1: 30s
  2: 60 * 1000,  // Retry 2: 60s
  3: 120 * 1000, // Retry 3: 120s
};

/**
 * Dispatches a batch of notification records
 * Consumes Array<NotificationLogDocument>
 */
const dispatchBatch = async (notifications) => {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return { dispatched: 0, failed: 0 };
  }

  let dispatched = 0;
  let failed = 0;

  for (const notif of notifications) {
    try {
      if (notif.channel === 'IN_APP') {
        // In-App notifications are delivered in-platform upon creation
        await NotificationLog.updateOne(
          { _id: notif._id },
          { $set: { deliveryStatus: 'DELIVERED_IN_APP' } }
        );
        dispatched++;
      } else if (notif.channel === 'SIMULATED_EMAIL' || notif.channel === 'SIMULATED_SMS') {
        // Test simulation hook: check if simulated failure was requested in metadata
        if (notif.metadata?.forceSimulatedFailure) {
          throw new Error('Simulated dispatch error for test verification');
        }

        // Output structured dispatch log (strictly simulated, no external HTTP calls)
        console.log(
          `[SIMULATED DISPATCH] [${notif.channel}] Alert=${notif.alertCode} Recipient=${notif.recipientContact} Title="${notif.title}" Status=DISPATCHED`
        );

        await NotificationLog.updateOne(
          { _id: notif._id },
          {
            $set: {
              deliveryStatus: 'DISPATCHED_SIMULATED',
              isSimulated: true,
              lastError: null,
            },
          }
        );
        dispatched++;
      }
    } catch (err) {
      failed++;
      // Initial attempt failed -> transition to FAILED with retryCount: 1 and schedule Retry 1
      const nextRetryAt = new Date(Date.now() + BACKOFF_SCHEDULE_MS[1]);
      await NotificationLog.updateOne(
        { _id: notif._id },
        {
          $set: {
            deliveryStatus: 'FAILED',
            retryCount: 1,
            nextRetryAt,
            lastError: err.message,
          },
        }
      );
      console.warn(
        `[NotificationDispatcher] Initial dispatch failed for ${notif._id} (${notif.channel}): ${err.message}`
      );
    }
  }

  return { dispatched, failed };
};

/**
 * Processes due retries and reclaims expired retry leases
 * Follows exact 4 total attempts policy (1 initial + 3 retries)
 */
const processRetryQueue = async () => {
  const now = new Date();
  let reclaims = 0;
  let retriesProcessed = 0;

  // 1. Reclaim expired RETRYING leases (worker crash recovery)
  const expiredLeases = await NotificationLog.find({
    deliveryStatus: 'RETRYING',
    retryLeaseAt: { $lte: now },
    retryCount: { $lte: 3 },
    isActive: true,
  });

  for (const item of expiredLeases) {
    await NotificationLog.updateOne(
      { _id: item._id, deliveryStatus: 'RETRYING' },
      {
        $set: {
          deliveryStatus: 'FAILED',
          retryLeaseAt: null,
          retryToken: null,
        },
      }
    );
    reclaims++;
  }

  // 2. Select due retries (retryCount: 1, 2, or 3)
  const dueItems = await NotificationLog.find({
    deliveryStatus: 'FAILED',
    nextRetryAt: { $lte: now },
    retryCount: { $lte: 3 },
    isActive: true,
  }).limit(20);

  for (const item of dueItems) {
    const claimToken = crypto.randomUUID();
    const leaseExpiry = new Date(Date.now() + 30000); // 30-second worker lease

    // Atomically claim lease with retryToken fencing
    const claimed = await NotificationLog.findOneAndUpdate(
      {
        _id: item._id,
        deliveryStatus: 'FAILED',
      },
      {
        $set: {
          deliveryStatus: 'RETRYING',
          retryLeaseAt: leaseExpiry,
          retryToken: claimToken,
        },
      },
      { new: true }
    );

    if (!claimed) continue; // Concurrently claimed by another worker

    try {
      if (claimed.metadata?.forceSimulatedFailure) {
        throw new Error('Simulated dispatch error in retry');
      }

      console.log(
        `[SIMULATED DISPATCH RETRY] [${claimed.channel}] Attempt=${claimed.retryCount + 1} Alert=${claimed.alertCode} Recipient=${claimed.recipientContact}`
      );

      // Retry succeeded
      await NotificationLog.updateOne(
        { _id: claimed._id, retryToken: claimToken },
        {
          $set: {
            deliveryStatus: 'DISPATCHED_SIMULATED',
            isSimulated: true,
            retryLeaseAt: null,
            retryToken: null,
            lastError: null,
          },
        }
      );
      retriesProcessed++;
    } catch (err) {
      const nextCount = claimed.retryCount + 1;

      if (nextCount > 3) {
        // 4th total attempt failed -> Terminal state PERMANENTLY_FAILED
        await NotificationLog.updateOne(
          { _id: claimed._id, retryToken: claimToken },
          {
            $set: {
              deliveryStatus: 'PERMANENTLY_FAILED',
              retryCount: 4,
              nextRetryAt: null,
              retryLeaseAt: null,
              retryToken: null,
              lastError: err.message,
            },
          }
        );
        console.warn(
          `[NotificationDispatcher] Notification ${claimed._id} PERMANENTLY_FAILED after 4 total attempts`
        );
      } else {
        // Schedule subsequent retry
        const backoffDelay = BACKOFF_SCHEDULE_MS[nextCount] || 30000;
        await NotificationLog.updateOne(
          { _id: claimed._id, retryToken: claimToken },
          {
            $set: {
              deliveryStatus: 'FAILED',
              retryCount: nextCount,
              nextRetryAt: new Date(Date.now() + backoffDelay),
              retryLeaseAt: null,
              retryToken: null,
              lastError: err.message,
            },
          }
        );
      }
      retriesProcessed++;
    }
  }

  return { reclaims, retriesProcessed };
};

/**
 * Cancels any pending or retrying external notifications for an acknowledged or closed alert
 */
const cancelPendingAlertNotifications = async (alertId) => {
  const result = await NotificationLog.updateMany(
    {
      alert: alertId,
      deliveryStatus: { $in: ['PENDING', 'FAILED', 'RETRYING'] },
      isActive: true,
    },
    {
      $set: {
        deliveryStatus: 'CANCELLED',
        nextRetryAt: null,
        retryLeaseAt: null,
        lastError: 'Alert acknowledged or closed; pending notification cancelled',
      },
    }
  );

  return result.modifiedCount || 0;
};

module.exports = {
  dispatchBatch,
  processRetryQueue,
  cancelPendingAlertNotifications,
  BACKOFF_SCHEDULE_MS,
};

