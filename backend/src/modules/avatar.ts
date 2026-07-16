import { rm } from "node:fs/promises";
import sharp, { type OutputInfo } from "sharp";

export const MAX_AVATAR_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_OUTPUT_BYTES = 200 * 1024;
const MAX_AVATAR_PIXELS = 40_000_000;

export class AvatarError extends Error {
  constructor(
    readonly status: 413 | 422,
    readonly code: "AVATAR_TOO_LARGE" | "INVALID_AVATAR",
    message: string,
  ) {
    super(message);
  }
}

function hasAllowedSignature(input: Buffer) {
  const jpeg = input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  const png = input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = input.length >= 12
    && input.subarray(0, 4).toString("ascii") === "RIFF"
    && input.subarray(8, 12).toString("ascii") === "WEBP";
  return jpeg || png || webp;
}

export async function processAvatar(input: Buffer, outputPath: string): Promise<OutputInfo> {
  if (input.length > MAX_AVATAR_INPUT_BYTES) {
    throw new AvatarError(413, "AVATAR_TOO_LARGE", "Ảnh đại diện không được vượt quá 5 MB");
  }
  if (!hasAllowedSignature(input)) {
    throw new AvatarError(422, "INVALID_AVATAR", "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP hợp lệ");
  }

  try {
    // Sharp 0.35 input safety and untrusted-input defaults:
    // https://sharp.pixelplumbing.com/api-constructor/
    const image = sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_AVATAR_PIXELS,
      pages: 1,
    });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) !== 1) {
      throw new AvatarError(422, "INVALID_AVATAR", "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP hợp lệ");
    }

    // autoOrient + cover performs the centered square crop; Sharp strips metadata by default.
    // https://sharp.pixelplumbing.com/api-resize/ and https://sharp.pixelplumbing.com/api-output/
    const info = await image
      .autoOrient()
      .resize(256, 256, { fit: "cover", position: "centre" })
      .webp({ quality: 80, effort: 6 })
      .toFile(outputPath);
    if (info.size > MAX_AVATAR_OUTPUT_BYTES) {
      throw new AvatarError(422, "INVALID_AVATAR", "Không thể tối ưu ảnh đại diện dưới 200 KB");
    }
    return info;
  } catch (error) {
    await rm(outputPath, { force: true });
    if (error instanceof AvatarError) throw error;
    throw new AvatarError(422, "INVALID_AVATAR", "Tệp ảnh bị lỗi hoặc không được hỗ trợ");
  }
}
