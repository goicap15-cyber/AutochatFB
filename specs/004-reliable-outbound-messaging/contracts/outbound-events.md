# Outbound Event Contract

## CRM → server: `SEND_MESSAGE`

```json
{
  "thread_id": "string",
  "content": "string",
  "client_message_id": "client_<unique>"
}
```

Server rejects empty content, unknown thread, account mismatch, or unavailable extension with a retryable error.

## Server → extension: `SEND_MESSAGE`

```json
{
  "type": "SEND_MESSAGE",
  "data": { "thread_id": "string", "content": "string", "client_message_id": "string" }
}
```

## Extension → server: `SEND_MESSAGE_RESULT`

Success requires an official ID:

```json
{ "thread_id": "string", "client_message_id": "string", "success": true, "message_id": "string" }
```

Failure:

```json
{ "thread_id": "string", "client_message_id": "string", "success": false, "error": "string", "error_code": "string" }
```

## Server → CRM

`MESSAGE_SEND_CONFIRMED` updates the pending record to sent. `MESSAGE_SEND_FAILED` updates it to failed. Repeated events with the same correlation key are idempotent.
