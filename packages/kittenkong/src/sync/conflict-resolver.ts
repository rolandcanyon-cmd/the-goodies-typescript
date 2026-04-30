/**
 * Conflict Resolver - Deterministic conflict resolution for sync
 *
 * Implements last-write-wins with tiebreaking, merge strategies,
 * and retry logic for sync conflicts.
 */

export interface ConflictData {
  id: string;
  version?: string;
  lastModified?: string;
  syncId?: string;
  deleted?: boolean;
  [key: string]: any;
}

export type ResolutionReason =
  | 'newer_local'
  | 'newer_remote'
  | 'sync_id_tiebreak_local'
  | 'sync_id_tiebreak_remote'
  | 'local_deleted'
  | 'remote_deleted'
  | 'missing_timestamp';

export class ConflictResolver {
  /**
   * Resolve a conflict between local and remote versions.
   * Returns the winning data and the reason for the resolution.
   */
  static resolveConflict(
    local: ConflictData,
    remote: ConflictData
  ): { winner: ConflictData; reason: ResolutionReason } {
    // Deletion takes precedence
    if (local.deleted) {
      return { winner: local, reason: 'local_deleted' };
    }
    if (remote.deleted) {
      return { winner: remote, reason: 'remote_deleted' };
    }

    const localTime = local.lastModified ? new Date(local.lastModified).getTime() : 0;
    const remoteTime = remote.lastModified ? new Date(remote.lastModified).getTime() : 0;

    // Missing timestamp: prefer remote (server is more authoritative)
    if (!local.lastModified || !remote.lastModified) {
      return { winner: remote, reason: 'missing_timestamp' };
    }

    // Within 1 second: use sync_id as tiebreaker
    const timeDiff = Math.abs(localTime - remoteTime);
    if (timeDiff < 1000) {
      const localSyncId = local.syncId || local.id || '';
      const remoteSyncId = remote.syncId || remote.id || '';
      if (localSyncId >= remoteSyncId) {
        return { winner: local, reason: 'sync_id_tiebreak_local' };
      }
      return { winner: remote, reason: 'sync_id_tiebreak_remote' };
    }

    // Clear winner: newer timestamp wins
    if (localTime > remoteTime) {
      return { winner: local, reason: 'newer_local' };
    }
    return { winner: remote, reason: 'newer_remote' };
  }

  /**
   * Merge changes into a base object, skipping protected fields.
   */
  static mergeChanges(base: Record<string, any>, changes: Record<string, any>): Record<string, any> {
    const result = { ...base };
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'id' || key === 'createdAt' || key === 'created_at') {
        continue;
      }
      result[key] = value;
    }
    return result;
  }

  /**
   * Determine if a sync should be retried based on conflict reason.
   */
  static shouldRetrySync(reason: string): boolean {
    const retryableReasons = ['network_error', 'timeout', 'server_error'];
    return retryableReasons.includes(reason);
  }
}
