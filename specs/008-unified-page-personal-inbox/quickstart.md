# Quickstart: Unified Page & Personal Inbox Validation

## Prerequisites

1. Node.js 18+ and npm installed
2. Running backend: `npm start` in project root
3. A Facebook Page with a valid Page Access Token (with `pages_messaging` + `pages_manage_metadata` permissions)
4. HTTPS endpoint for webhook (use `ngrok` for local dev: `ngrok http 5050`)
5. Meta App Secret (from Meta Developer Dashboard)

## Environment Setup

```bash
# Add to .env or export before starting server
export META_APP_SECRET="your_meta_app_secret"
export PAGE_TOKEN_SECRET="any_32_char_random_string_for_encryption"
export WEBHOOK_VERIFY_TOKEN="any_random_string_for_webhook_verify"
```

## Validation Scenarios

### Scenario 1: Personal Messenger Still Works

1. Start backend: `npm start`
2. Open Facebook/Messenger in Chrome with the extension loaded
3. Send a message from CRM to a personal Messenger thread
4. **Expected**: Message appears in Messenger, CRM shows "sent" status
5. Receive a message in personal Messenger
6. **Expected**: Message appears in CRM with source badge "Messenger cá nhân"

### Scenario 2: Connect a Facebook Page

1. Navigate to CRM Settings > Inbox Sources
2. Click "Add Page"
3. Paste the Page Access Token
4. **Expected**: Page appears in the sources list with name, avatar, and "ACTIVE" status

### Scenario 3: Receive Page Message via Webhook

1. Ensure ngrok is running and webhook is subscribed in Meta Developer Dashboard
2. From a test Facebook account, send a message to the connected Page
3. **Expected**: 
   - Backend log shows `[PAGE_WEBHOOK_RECEIVED]` and `[PAGE_MESSAGE_PERSISTED]`
   - CRM shows the message in a new thread with source badge "Page · [PageName]"
   - Message appears within 3 seconds

### Scenario 4: Reply to Page Conversation

1. Open a Page conversation in CRM
2. Type a reply and send
3. **Expected**:
   - Backend log shows `[PAGE_SEND_REQUEST]` and `[PAGE_SEND_RESULT]`
   - Customer receives the reply on Messenger
   - CRM shows message as "sent"

### Scenario 5: Source Filtering

1. Have conversations from both personal and Page sources
2. Use the source filter dropdown in the sidebar
3. Select "Page" → **Expected**: Only Page conversations shown
4. Select "Page: MissPrice" → **Expected**: Only MissPrice conversations shown
5. Select "Tất cả nguồn" → **Expected**: All conversations shown

### Scenario 6: Cross-Source Isolation

1. Reply to a Page "MissPrice" conversation
2. **Expected**: Message sent via Page Send API, NOT through Chrome extension
3. Reply to a personal Messenger conversation
4. **Expected**: Message sent via Chrome extension, NOT through Page API

### Scenario 7: Webhook Deduplication

1. Simulate Meta sending the same webhook event twice (can use curl)
2. **Expected**: Only 1 message persisted in the database

### Scenario 8: Multi-Source View

1. Connect 1 personal account + 2 Pages
2. **Expected**: CRM sidebar shows 3 sources in the filter dropdown
3. Conversations from all 3 sources appear in the unified list

## Troubleshooting

- **Webhook not receiving**: Check ngrok is running, webhook URL is correctly configured in Meta Dashboard
- **Token errors**: Verify Page Access Token has correct permissions, check expiry
- **Missing source badges**: Ensure migration ran (check for `inbox_sources` table in SQLite)
