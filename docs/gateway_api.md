# NEIA Gateway API (v1)

Apps should not care about the transport (ZeroMQ vs LavinMQ). The NEIA API
wraps transport selection and exposes a uniform command + event interface.

## Endpoints

### Send Command
`POST /api/v1/gateway/command`

Body:
```
{
  "type": "discover_sensors",
  "payload": {}
}
```

Returns:
```
{ "status": "sent" }
```

### Stream Events (WebSocket)
`GET /api/v1/gateway/events`

The server pushes all gateway events (EVT_*), for example:
```
{
  "type": "server_ready",
  "payload": { ... },
  "site": "my_house"
}
```

### Purge Queues (LavinMQ only)
`POST /api/v1/gateway/purge`

Returns:
```
{ "status": "purged" }
```

### Gateway Status
`GET /api/v1/gateway/status`

Returns:
```
{ "gateway": "zeromq" }
```

## Configuration
Environment variables:
- `NEIA_GATEWAY`: `zeromq` (default) or `lavinmq`
- `NEIA_SITE`: site id for LavinMQ queues (default `my_house`)
- `AMQP_URL`: LavinMQ connection URL (required if using lavinmq)
- `ZEROMQ_CMD_CONNECT`: ZeroMQ command endpoint (default `tcp://localhost:5555`)
- `ZEROMQ_EVENT_CONNECT`: ZeroMQ event endpoint (default `tcp://localhost:5556`)

## Notes
- Apps call the same endpoints regardless of gateway transport.
- The API broadcasts raw events; app UIs decide how to interpret them.
