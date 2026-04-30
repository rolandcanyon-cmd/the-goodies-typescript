/**
 * Sync script — pulls all entities and relationships from FunkyGibbon
 * into kittenkong's local graph.
 *
 * Usage: npx tsx scripts/sync-from-funkygibbon.ts
 */

import { KittenKongClient } from '../src/index';
import type { EntityRelationship } from '@the-goodies/inbetweenies';

const SERVER_URL = process.env.FUNKYGIBBON_URL || 'http://localhost:8000';

async function main() {
  console.log(`Connecting to FunkyGibbon at ${SERVER_URL}...`);

  const client = new KittenKongClient({
    serverUrl: SERVER_URL,
    clientId: 'kittenkong-primary',
  });

  // Connect and do initial entity sync via protocol
  await client.connect();
  console.log(`Offline: ${client.isOffline}`);

  // Perform entity sync
  console.log('Syncing entities via Inbetweenies protocol...');
  const result = await client.sync();
  console.log(`  Entities received: ${result.changesReceived}`);

  // Fetch relationships from the graph API (not included in sync protocol)
  console.log('Fetching relationships from graph API...');
  const relResponse = await fetch(`${SERVER_URL}/api/v1/graph/relationships`);
  if (relResponse.ok) {
    const relData = await relResponse.json() as any;
    const serverRels: any[] = relData.relationships || relData;

    let imported = 0;
    for (const rel of serverRels) {
      await client.createRelationship(
        rel.from_entity_id,
        rel.to_entity_id,
        rel.relationship_type.toUpperCase(),
        rel.properties || {},
        rel.user_id || 'system'
      );
      imported++;
    }
    console.log(`  Relationships imported: ${imported}`);
  }

  // Show what we have locally
  const stats = client.getGraphStatistics();
  console.log(`\nLocal graph:`);
  console.log(`  Entities: ${stats.totalEntities}`);
  console.log(`  Relationships: ${stats.totalRelationships}`);
  console.log(`  Types:`, JSON.stringify(stats.entityCountByType, null, 4));
  console.log(`  Relationship types:`, JSON.stringify(stats.relationshipCountByType, null, 4));
  console.log(`  Isolated entities: ${stats.isolatedEntities}`);

  // List rooms and their devices
  const rooms = await client.searchEntities('*', ['ROOM' as any], 200);
  console.log(`\n--- Rooms (${rooms.length}) ---`);
  for (const room of rooms.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
    const devicesResult = await client.executeMCPTool('get_devices_in_room', { room_id: room.id });
    const deviceCount = devicesResult.result?.count || 0;
    const deviceNames = (devicesResult.result?.devices || []).map((d: any) => d.name).join(', ');
    console.log(`  ${room.name}${deviceCount > 0 ? ` → ${deviceNames}` : ''}`);
  }

  // List devices
  const devices = await client.searchEntities('*', ['DEVICE' as any], 200);
  console.log(`\n--- Devices (${devices.length}) ---`);
  for (const device of devices.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
    console.log(`  ${device.name} (${device.sourceType})`);
  }

  await client.disconnect();
  console.log('\nSync complete.');
}

main().catch(console.error);
