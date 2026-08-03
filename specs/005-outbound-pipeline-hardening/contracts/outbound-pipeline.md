# Outbound Pipeline Contract

`SEND_MESSAGE_RESULT` MUST include `thread_id`, `client_message_id`, `success`, and either `message_id` or `error_code`.

Stages: `GRAPHQL`, `COMPOSER_CLICK`, `ENTER_SUBMIT`, `CONFIRMATION`, `CORRELATION`.

`NEW_MESSAGE_RECEIVED` with an existing `fb_message_id` is idempotent. It MUST NOT throw or update another row's unique ID.
