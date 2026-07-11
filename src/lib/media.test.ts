import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMediaUpload,
  MAX_SOURCE_BYTES,
  PROCESSING_THRESHOLD_BYTES,
  requiresProcessing,
  assertMediaPayload,
} from "./media";

test("accepts the supported media types", () => {
  assert.equal(assertMediaUpload({ size: 1, type: "image/gif" } as File).extension, "gif");
  assert.equal(assertMediaUpload({ size: 1, type: "video/mp4" } as File).kind, "video");
});

test("detects media from file signatures", () => {
  assert.equal(assertMediaPayload(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])).mimeType, "image/png");
  assert.equal(assertMediaPayload(new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0])).mimeType, "video/mp4");
  assert.throws(() => assertMediaPayload(new Uint8Array([1, 2, 3])));
});

test("enforces the media type and source-size boundaries", () => {
  assert.throws(() => assertMediaUpload({ size: 1, type: "image/svg+xml" } as File));
  assert.throws(() => assertMediaUpload({ size: MAX_SOURCE_BYTES + 1, type: "video/mp4" } as File));
  assert.equal(requiresProcessing(PROCESSING_THRESHOLD_BYTES), false);
  assert.equal(requiresProcessing(PROCESSING_THRESHOLD_BYTES + 1), true);
});
