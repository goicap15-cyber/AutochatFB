# Research and Decisions

1. Facebook GraphQL currently returns HTTP 200 with empty bodies; it cannot be the delivery boundary.
2. Synthetic `KeyboardEvent` is untrusted and is ignored by Messenger in the failing case.
3. Messenger exposes an accessible send control but renders it asynchronously; polling is required.
4. A browser-level CDP `Input.dispatchKeyEvent` is the Enter fallback; it requires the Chrome `debugger` permission and must attach/detach safely.
5. DOM/network confirmation, not click return value, is the success signal.
6. The replacement must be feature-gated so rollback does not alter persisted history.
