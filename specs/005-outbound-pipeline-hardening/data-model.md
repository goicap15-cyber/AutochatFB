# Data Model

## SendAttempt

`client_message_id`, `thread_id`, `account_id`, `content`, `status`, `stage`, `fb_message_id`, `error_code`, `attempt_number`, `created_at`, `updated_at`.

## Allowed transitions

`pending → graphql_failed → composer_click → enter_submit → sent` or `failed`.
Any confirmation may transition a matching pending attempt directly to `sent`; repeated confirmations are no-ops.
