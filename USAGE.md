# Usage

This document provides detailed instructions for setting up, configuring, and using the WaveForge MCP server.

## 🚀 Quick Start

### Environment Requirements

- Node.js >= 18.0.0
- pnpm (recommended) or npm

### Installation

```bash
pnpm install
```

### Development Mode

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Testing

```bash
pnpm test
```

### Start Server

```bash
# Development mode
pnpm dev

# Production mode
pnpm start
```

## 🔧 MCP Tools

### Health Tool

Checks the server's health status, returning uptime, memory usage, etc.

**Schema:**
```json
{
  "name": "health",
  "description": "检查服务器健康状态",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

### Ping Tool

Tests the server connection and can optionally echo a message.

**Schema:**
```json
{
  "name": "ping",
  "description": "测试服务器连接",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "可选的测试消息",
        "maxLength": 1000
      }
    },
    "additionalProperties": false
  }
}
```

## 📝 Configuration

### Environment Variables

| Variable             | Description                                     | Default                              |
| -------------------- | ----------------------------------------------- | ------------------------------------ |
| `WF_LOG_LEVEL`       | Log level (`INFO`, `WARNING`, `ERROR`, `TEACH`) | `INFO`                               |
| `WF_DOCS_ROOT`       | Documentation root directory                    | `.wave`                              |
| `WF_DEVLOG_TEMPLATE` | Path to the Devlog template                     | `.wave/templates/devlog-template.md` |
| `WF_DEBUG`           | Debug mode (`true` or `false`)                  | `false`                              |


### MCP Client Configuration

Add the following to your MCP client configuration:

```json
{
  "mcpServers": {
    "waveforge": {
      "command": "node",
      "args": ["path/to/waveforge/dist/server.js"],
      "env": {
        "WF_LOG_LEVEL": "INFO"
      }
    }
  }
}
```