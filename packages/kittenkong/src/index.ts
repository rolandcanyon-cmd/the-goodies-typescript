/**
 * KittenKong - TypeScript Client for The Goodies
 *
 * PURPOSE:
 * Main entry point for the KittenKong TypeScript client library.
 * Provides access to FunkyGibbon server, authentication, and MCP tools.
 *
 * EXPORTS:
 * - KittenKongClient: Main client for server communication
 * - AuthManager: Authentication and token management
 * - All Inbetweenies protocol types (Entity, EntityRelationship, etc.)
 *
 * VERSION HISTORY:
 * - 2025-04-02: Initial TypeScript port from Python blowing-off package
 *   - Added AuthManager export
 *   - Added comprehensive context header
 *
 * PORTED FROM:
 * Python: blowing-off package
 */

export * from './client';
export * from './auth';
export type * from '@the-goodies/inbetweenies';
