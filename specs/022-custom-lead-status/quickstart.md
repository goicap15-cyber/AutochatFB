# Quickstart: Verify Lead Status Color Picker

1. Install dependencies and start the existing CRM frontend/backend workflow.
2. Open a conversation and confirm no color picker is visible.
3. Open “Tạo trạng thái mới”; open the color control and choose an arbitrary color.
4. Cancel the picker: the prior swatch must remain. Reopen, choose again, and Apply: the create-form swatch must update without an API request.
5. Enter a name and press outer “Tạo”: exactly one POST is sent with canonical `#RRGGBB`.
6. Confirm the new status is selected and the same color appears in the dropdown and sidebar after reload.
7. Reopen creation and test outer Cancel, contact switching, Escape, and outside-click; no stale draft may survive.
8. Repeat in light/dark themes, keyboard-only, narrow panel, and 200% zoom.
9. Send invalid and alpha color payloads directly to the endpoint and confirm HTTP 400.
10. Run targeted tests, persistence tests, UI build, and server syntax checks documented in the repository scripts.
