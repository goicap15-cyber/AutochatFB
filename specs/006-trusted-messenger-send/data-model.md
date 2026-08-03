# Data Model

## OutboundAttempt

`client_message_id`, `thread_id`, `account_id`, `content_length`, `status`, `stage`, `attempt_number`, `fb_message_id`, `error_code`, `created_at`, `updated_at`.

## States

`pending → click_pending → click_confirmed → sent`

`click_pending → enter_pending → sent`

Any state → `failed` only after bounded timeout or definitive error. Repeated confirmations are no-ops.
