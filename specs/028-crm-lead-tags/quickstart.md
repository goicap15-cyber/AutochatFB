# Quickstart: Verify CRM Lead Tags

1. Start the already-running backend on port 5050 and load the CRM.
2. Open a conversation with the Lead Details panel.
3. Confirm “Tiềm năng”, “Quan tâm”, and “Cần tư vấn” render as buttons; no tag is changed before clicking.
4. Click “Tiềm năng”: it becomes selected with a non-color cue; click again to remove it.
5. Open “+ Thêm” or “Quản lý nhãn”; add Khách VIP with Enter, then remove it and Cancel. Confirm Cancel restores the committed list.
6. Add Khách VIP again and Apply. Switch conversations and return; confirm the tag remains.
7. Try khách vip, blank input, control characters, 41+ characters, and the 21st tag; confirm accessible validation and no duplicate.
8. Seed an existing unknown tag through the database/API and confirm it remains visible and removable.
9. Simulate a failed PUT; confirm optimistic changes roll back and the error remains visible with retry possible.
10. Verify Lead Status, workflow tabs, and rich-message composer are unaffected.
11. Repeat with keyboard-only navigation, light/dark themes, narrow drawer, and 200% zoom.
12. Run targeted tests, npm run test:persistence, and npm run build:ui.
