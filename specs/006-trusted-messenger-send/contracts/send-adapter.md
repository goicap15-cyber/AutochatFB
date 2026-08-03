# Send Adapter Contract

## Extension command

`SEND_MESSAGE` receives `thread_id`, `content`, and `client_message_id`.

## Result

`SEND_MESSAGE_RESULT` returns `client_message_id`, `success`, `stage`, and either `message_id` or `error_code`.

Stages: `POLL_COMPOSER`, `DOM_CLICK`, `CDP_ENTER`, `CONFIRMATION`.

The result must never contain tokens, cookies, or full response bodies.
