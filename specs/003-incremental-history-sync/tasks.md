# Tasks: Incremental History Sync

## Phase 1 — Spec and Graphify baseline

- [X] T044 [P] Chốt contract và JSON cursor trong contracts/incremental-sync.md và data-model.md.
- [ ] T045 Chạy Graphify baseline cho client → server → extension → repository/database.

## Phase 2 — Checkpoint foundation

- [X] T046 Validate encode/decode cursor và state transitions trong src/server/services/HistorySyncManager.js.
- [X] T047 Chỉ ghi checkpoint sau transaction batch thành công; giữ partial batch.
- [X] T048 Chọn initial/incremental/backfill và không xóa khi snapshot rỗng.

## Phase 3 — Extension incremental crawl

- [X] T049 Truyền mode/boundary vào src/extension/background.js và dừng tại known boundary.
- [X] T050 Native ID trước, fingerprint fallback ổn định sau.
- [X] T051 Emit fetched/inserted/skipped/checkpoint diagnostics.

## Phase 4 — Backend and UI delta

- [X] T052 Upsert chỉ message thiếu và emit delta.
- [X] T053 Local-first reconnect/offline load và resume từ cursor.

## Phase 5 — Tests and validation

- [ ] T054 Unit test cursor, boundary, same-minute và fingerprint collision.
- [ ] T055 Integration test five unchanged syncs, interrupted resume, empty snapshot, multi-source dedup.
- [ ] T056 E2E hai thread, backfill/reload rồi graphify update . và lưu kết quả.

## Dependencies

T044–T045 → T046–T048 → T049–T051 → T052–T053 → T054–T056.
