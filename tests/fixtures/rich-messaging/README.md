# Rich Messaging Test Fixtures

Tests in this feature should generate small buffers in memory or inside an OS temporary directory. Do not commit customer media, production exports, executable payloads, or files containing personal data.

## Signatures

- JPEG: FF D8 FF prefix plus a minimal test payload.
- PNG: standard 8-byte PNG signature.
- WebP: RIFF container with WEBP at bytes 8–11.
- PDF: %PDF- header and %%EOF trailer for structural tests.

## Boundaries

- Unit fixtures should remain below 1 KiB unless a size-boundary test is required.
- Size-boundary tests create sparse or repeated-byte files in a temporary directory and remove them after the test.
- Filename tests may use synthetic Vietnamese names such as Bao_gia_thang_8.pdf.
- Traversal tests must pass the malicious name only to the sanitation helper; never create files outside the temporary root.
- Integration tests use a temporary attachment storage root injected into the service and must not write to data/outbound-attachments.

## Live acceptance

The live two-source matrix uses dedicated non-customer test conversations. Keep the sample PNG/PDF outside the repository and record only checksum, byte size, and outcome in the test notes.
