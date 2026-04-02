# the-goodies-typescript

TypeScript client implementation of The Goodies distributed MCP knowledge graph

## Overview

This is a complete TypeScript port of The Goodies client libraries, enabling TypeScript/Node.js applications to interact with FunkyGibbon servers.

## Packages

### inbetweenies
TypeScript protocol package based on the Python [inbetweenies](https://github.com/adrianco/the-goodies/tree/main/inbetweenies) protocol.

Provides:
- Entity and relationship models
- Type definitions for all entity types
- Serialization/deserialization
- Protocol types

### kittenkong
TypeScript client package based on Python [blowing-off](https://github.com/adrianco/the-goodies/tree/main/blowing-off) that depends on inbetweenies to communicate with the Python-based [funkygibbon](https://github.com/adrianco/the-goodies/tree/main/funkygibbon) server.

Provides:
- REST API client for FunkyGibbon
- Local SQLite storage (optional)
- Sync engine
- Authentication management
- MCP tool execution

## Installation

```bash
npm install @the-goodies/inbetweenies
npm install @the-goodies/kittenkong
```

## Quick Start

```typescript
import { KittenKongClient } from '@the-goodies/kittenkong';

// Connect to FunkyGibbon server
const client = new KittenKongClient({
  serverUrl: 'http://localhost:8000',
  authToken: 'your-token'
});

// Authenticate
await client.loginAdmin('password');

// Create an entity
const device = await client.createEntity({
  entityType: 'DEVICE',
  name: 'Smart Light',
  content: {
    manufacturer: 'Philips',
    model: 'Hue'
  }
});

// Search entities
const results = await client.searchEntities('smart light');

// Sync with server
await client.sync();
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## For End-to-End Testing

Install and run the FunkyGibbon server from [the-goodies](https://github.com/adrianco/the-goodies):

```bash
cd ~/the-goodies
./start_funkygibbon.sh
```

Server will be available at `http://localhost:8000`

## Related Projects

- [the-goodies](https://github.com/adrianco/the-goodies) - Python implementation (FunkyGibbon server, Blowing-Off client, Inbetweenies protocol)
- [the-goodies-swift](https://github.com/adrianco/the-goodies-swift) - Swift client implementation
- [c11s-house-ios](https://github.com/adrianco/c11s-house-ios) - iOS app using The Goodies

## License

MIT
