/**
 * Entity and Relationship Types for The Goodies
 * TypeScript port of Python inbetweenies/models.py
 */

/** Entity types in the knowledge graph */
export enum EntityType {
  HOME = 'HOME',
  ROOM = 'ROOM',
  DEVICE = 'DEVICE',
  ZONE = 'ZONE',
  DOOR = 'DOOR',
  WINDOW = 'WINDOW',
  PROCEDURE = 'PROCEDURE',
  MANUAL = 'MANUAL',
  NOTE = 'NOTE',
  SCHEDULE = 'SCHEDULE',
  AUTOMATION = 'AUTOMATION',
  APP = 'APP'
}

/** Source types for entity creation */
export enum SourceType {
  MANUAL = 'MANUAL',
  HOMEKIT = 'HOMEKIT',
  MATTER = 'MATTER',
  ZIGBEE = 'ZIGBEE',
  ZWAVE = 'ZWAVE',
  API = 'API'
}

/** Relationship types between entities */
export enum RelationshipType {
  LOCATED_IN = 'LOCATED_IN',
  CONTROLS = 'CONTROLS',
  CONNECTS_TO = 'CONNECTS_TO',
  PART_OF = 'PART_OF',
  MANAGES = 'MANAGES',
  DOCUMENTED_BY = 'DOCUMENTED_BY',
  PROCEDURE_FOR = 'PROCEDURE_FOR',
  TRIGGERED_BY = 'TRIGGERED_BY',
  DEPENDS_ON = 'DEPENDS_ON',
  CONTROLLED_BY_APP = 'CONTROLLED_BY_APP',
  HAS_BLOB = 'HAS_BLOB'
}

/** BLOB types for binary storage */
export enum BlobType {
  PDF = 'PDF',
  JPEG = 'JPEG',
  PNG = 'PNG',
  BINARY = 'BINARY'
}

/** BLOB sync status */
export enum BlobStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  UPLOADED = 'UPLOADED',
  DOWNLOADED = 'DOWNLOADED',
  SYNC_FAILED = 'SYNC_FAILED'
}

/** Base entity structure */
export interface Entity {
  id: string;
  version: string;
  entityType: EntityType;
  parentVersions?: string[];
  content: Record<string, any>;
  userId: string;
  sourceType: SourceType;
  createdAt: Date;
  lastModified: Date;
  name?: string;  // Often in content, but commonly accessed
}

/** Entity relationship */
export interface EntityRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: RelationshipType;
  properties?: Record<string, any>;
  userId: string;
  createdAt: Date;
}

/** Binary large object for files */
export interface Blob {
  id: string;
  entityId: string;
  entityVersion: string;
  name: string;
  blobType: BlobType;
  mimeType: string;
  size: number;
  checksum: string;
  status: BlobStatus;
  data?: Uint8Array;  // Optional, may not be loaded
  blobMetadata?: Record<string, any>;
  createdAt: Date;
  syncedAt?: Date;
}

/** Sync metadata for client state */
export interface SyncMetadata {
  clientId: string;
  serverUrl: string;
  lastSyncTime?: Date;
  lastSuccessTime?: Date;
  totalSyncs: number;
  syncFailures: number;
  totalConflicts: number;
  syncInProgress: boolean;
  lastError?: string;
}

/** Conflict information */
export interface Conflict {
  entityId: string;
  entityType: EntityType;
  localVersion: string;
  remoteVersion: string;
  reason: string;
  resolvedAt?: Date;
}

/** Sync result */
export interface SyncResult {
  syncedEntities: number;
  changesSent: number;
  changesReceived: number;
  conflictsResolved: number;
  conflicts: Conflict[];
  duration: number;  // seconds
}
