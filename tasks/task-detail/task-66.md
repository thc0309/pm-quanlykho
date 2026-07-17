# T66: Review và cleanup v6

## Goal

Review toàn bộ scope route form và product specs, chạy regression rộng và đơn giản hóa code lặp.

## Acceptance Criteria

- [ ] Full lint/build/test pass hoặc blocker ghi rõ.
- [ ] Review không còn high/medium finding chưa xử lý.
- [ ] Không duplicate form create/edit lớn ở metadata/product page.
- [ ] Permission `catalog.specs.*` và route create/edit metadata được enforce backend, reflected UI và có regression thiếu quyền.

## Verification

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `$vibe-review`

## Dependencies

- T65

## Likely Files

- All files changed by T54-T65.

## Recommended Skills

- `vibe-review`
- `code-review-and-quality`
- `vibe-simplify`
