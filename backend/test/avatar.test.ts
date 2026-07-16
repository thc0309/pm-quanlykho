import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";

import {
  AvatarError,
  MAX_AVATAR_INPUT_BYTES,
  MAX_AVATAR_OUTPUT_BYTES,
  processAvatar,
} from "../src/modules/avatar.js";

test("avatar processor writes a stripped 256x256 WebP under 200 KB", async () => {
  const directory = await mkdtemp(join(tmpdir(), "warehouse-avatar-"));
  const output = join(directory, "avatar.webp");
  try {
    const input = await sharp({
      create: { width: 480, height: 240, channels: 3, background: "#2563eb" },
    }).png().withMetadata({ orientation: 6 }).toBuffer();

    const info = await processAvatar(input, output);
    const metadata = await sharp(await readFile(output)).metadata();

    assert.equal(info.format, "webp");
    assert.equal(metadata.width, 256);
    assert.equal(metadata.height, 256);
    assert.ok(info.size <= MAX_AVATAR_OUTPUT_BYTES);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.xmp, undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("avatar processor rejects oversized and spoofed files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "warehouse-avatar-"));
  try {
    await assert.rejects(
      processAvatar(Buffer.alloc(MAX_AVATAR_INPUT_BYTES + 1), join(directory, "large.webp")),
      (error: unknown) => error instanceof AvatarError && error.status === 413,
    );
    await assert.rejects(
      processAvatar(Buffer.from("not-an-image"), join(directory, "fake.webp")),
      (error: unknown) => error instanceof AvatarError && error.status === 422,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
