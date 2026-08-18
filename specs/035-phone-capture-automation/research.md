# Research: Phone Capture Automation

## Exact mobile-prefix allowlist

**Decision**: Normalize to a domestic 10-digit representation and validate against a precise, data-backed allowlist rather than broad families such as `05x` or `08x`.

**Approved initial values**: `032–039`, `052`, `055`, `056`, `058`, `059`, `070`, `076–079`, `081–089`, `090–094`, `096–099`.

**095 policy**: `095` was awarded to Viettel in July 2026. Represent it as a versioned prefix record with an activation switch/effective date; do not accept every `09x` merely because it matches a broad regex.

**Rationale**: The current extractor accepts too many 05/08/09 variants and misses valid values. The exact data can change without a parser rewrite.

**Sources**: [Bộ TT&TT](https://mic.gov.vn/bo-tttt-day-manh-dinh-danh-cuoc-goi-de-ngan-ngua-lua-dao-tren-khong-gian-mang-19724111208351436.htm), [Viettel prefix list](https://www.vietteltelecom.vn/tin-tuc/tin-dich-vu/bi-quyet-chon-sim-so-dep-viettel-ban-co-biet/19762220), [VinaPhone prefix list](https://vinaphone.com.vn/English/News/Details/danh-sach-so-dien-thoai-dau-so-vinaphone-moi-nhat-2024.html), [Wintel 055](https://wintel.vn/ho-tro/thong-tin-chung), [Viettel 095 allocation](https://nhandan.vn/dau-gia-thanh-cong-viettel-so-huu-them-dau-so-095-post974880.html).

## Normalization and boundaries

**Decision**: Accept ordinary spaces, dots, hyphens and parentheses; accept domestic `0`, `84` and `+84`; normalize before checking exact prefix and length. Require non-digit boundaries and never strip every non-digit from the whole message.

**Rationale**: Customers type these forms in Messenger. Whole-message digit stripping would turn unrelated IDs into false phone numbers.

## Evidence versus selected contact value

**Decision**: Store each message-backed candidate immutably. Keep one separately selected `contacts.phone`; auto-capture fills it only when empty. Existing manual, legacy or confirmed values are never overwritten—different captures become dated candidates.

**Rationale**: This retains the user-requested acquisition date and source message, while avoiding destructive overwrite.

## Campaign safety

**Decision**: Make the campaign response opt-in per campaign: `continue` (default), `stop_remaining`, or `thank_then_stop`. Stop only future undispatched work. Queue thank-you through the existing outbound confirmation pipeline and key one action by recipient plus capture.

**Rationale**: A capture cannot recall an already dispatched message, and an inbound replay must not duplicate a thank-you.

## Status handling

**Decision**: A campaign may select an existing status such as `Đã có số`, or none. If it has since been removed, capture/stop still complete and the audit explicitly records the unavailable-status outcome.
