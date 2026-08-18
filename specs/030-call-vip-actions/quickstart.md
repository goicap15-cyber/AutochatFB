# Quickstart Validation: CRM VIP Quick Action

## Prerequisites

1. Start the CRM backend with \`npm start\`.
2. Start the frontend with \`npm run dev:ui\` when developing locally.
3. Open a conversation with the customer-information panel visible.

## Automated validation

\`\`\`bash
npm run test:persistence
npm run build:ui
\`\`\`

Expected: all tests pass and the frontend build completes without errors.

## Manual validation

1. Use a contact with other tags and no VIP. Activate VIP.
2. Verify immediate selected feedback, persistence after re-opening the contact, and that other tags remain.
3. Activate VIP again and verify VIP is removed after reload.
4. Test a stored spelling such as \`vip\`; confirm it is treated as selected and removing it does not leave a duplicate.
5. Simulate a failed contact save; confirm the selected feedback reverts and a retryable error appears.
6. Start a VIP save, switch to another conversation before it resolves, then confirm the old response does not alter the new customer.
7. Test in the narrow drawer, at browser zoom 200%, and with keyboard only.

## Regression checklist

- Saving phone/email/address/notes still works.
- Existing tag chips and custom tag editor still work.
- Lead Status and conversation filters retain their current behavior.
- Gọi, Nhắc and Lưu retain their current behavior.
