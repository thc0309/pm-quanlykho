# T27: Add optional Tauri silent printing

## Acceptance

Starts only after printer approval; desktop adapter prints only approved document types to configured Windows printer and surfaces recoverable errors.

## Verification

Signed test build plus physical printer evidence; no stock API is called by print retry.

## Dependencies

T26 and explicit human approval.

## Likely Files

- Tauri config.
- Minimal Rust print adapter.
- Frontend bridge.
- Device evidence.

## Skills

- `source-driven-development`
- `security-and-hardening`
- `browser-testing-with-devtools`
- Dedicated Tauri-print skill if available then.
