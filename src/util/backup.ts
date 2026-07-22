/**
 * Auto-export all buckets as a JSON backup file.
 *
 * Runs on app startup (and periodically) if the user has enabled it in
 * settings. Uses the browser download mechanism (`<a download>`) which
 * saves to the default download directory without a save dialog — this
 * is intentional for an automatic, unattended backup. See #406.
 */

import moment from 'moment';
import { useSettingsStore } from '~/stores/settings';
import { exportAllBucketsLong } from '~/util/awclient';
import { downloadFile } from '~/util/export';

const BACKUP_FILENAME_PREFIX = 'aw-backup-';

/**
 * Check if an automatic backup is due and, if so, perform it.
 * Called once on app startup. Safe to call repeatedly — it's a no-op
 * when disabled or not yet due.
 */
export async function autoBackupIfNeeded(): Promise<void> {
  const settingsStore = useSettingsStore();
  await settingsStore.ensureLoaded();

  if (!settingsStore.autoBackupEnabled) {
    return;
  }

  const intervalMs = settingsStore.autoBackupIntervalHours * 60 * 60 * 1000;
  const lastTime = settingsStore.autoBackupLastTime
    ? moment(settingsStore.autoBackupLastTime)
    : null;

  if (lastTime && moment().diff(lastTime) < intervalMs) {
    return;
  }

  await performBackup();
}

/**
 * Export all buckets and trigger a download. Updates `autoBackupLastTime`
 * in settings on success.
 */
export async function performBackup(): Promise<void> {
  try {
    const data = await exportAllBucketsLong();
    const timestamp = moment().format('YYYYMMDD-HHmmss');
    const filename = `${BACKUP_FILENAME_PREFIX}${timestamp}.json`;
    await downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');

    // Record the backup time so the next check knows when the last one ran.
    const settingsStore = useSettingsStore();
    await settingsStore.update({ autoBackupLastTime: moment().toISOString() });
    console.info(`Auto-backup saved: ${filename}`);
  } catch (e) {
    console.error('Auto-backup failed:', e);
  }
}
