# Editor Category, Tag, and New Post Flow

## Goal

Fix two editor usability problems and make the verification path explicit:

1. A comma typed in the category or tag field must remain usable while the author is entering values.
2. An author opening a past post must have an obvious way to return to a clean new-post editor.

## Confirmed Current Behavior

- Category and tag inputs are rendered from arrays joined with `", "`.
- Each input change immediately splits the value and writes the resulting array back to metadata.
- A trailing comma is removed during the same render cycle, so the author cannot continue entering a comma-delimited value naturally.
- Opening a past post sets `editingPath`, metadata, and body, but there is no action that clears editing mode and restores a new-post draft.
- Pushing source to GitHub does not rebuild or restart the running public service automatically. Verification must distinguish source changes from the deployed Next.js bundle.

## Requirements

### R1: Stable Category and Tag Editing

- Keep category and tag field text in independent string state while the field is being edited.
- On every `onChange`, update only the corresponding raw string; never replace the input value with `array.join()` during the same keystroke.
- The comma character must remain visible immediately after it is typed, including a trailing comma and a comma followed by a space.
- Parse the raw strings into canonical `string[]` metadata at blur and immediately before preview publication or existing-post update.
- Split on ASCII comma `,` and full-width comma `，` to support Traditional Chinese keyboard input.
- Trim each value and remove empty values created by repeated or trailing delimiters.
- Preserve entered order and do not silently deduplicate values.
- Loaded posts must initialize raw strings from their parsed metadata.
- A new post must start with category `全部` and no tags, while still allowing the author to edit or remove the default category.

### R2: Return to a New Post

- Provide a clearly labelled `新增文章` action in the past-post editor.
- Activating `新增文章` must clear `editingPath`, reset title/body/date/draft/comments/categories/tags to the existing new-post defaults, keep the selected repository profile and past-post list, and restore the `發布到 GitHub` action.
- The new-post action must not write to GitHub or the database.
- Selecting a past post continues to highlight it and exposes update/delete actions until the author chooses `新增文章`.

### R3: Protect Unsaved Work

- Track whether the current editor differs from its new-post or loaded-post baseline, including raw category/tag text.
- Before replacing dirty content by opening another past post or choosing `新增文章`, show a discard confirmation.
- If the author cancels, retain all current editor values and do not fetch or load another post.
- A failed request or parse error while opening a post must leave the current editor unchanged.
- Successful publish/update and an explicit reset establish a new clean baseline.

### R4: Preserve Publishing Semantics

- Preview, new-post publication, and existing-post updates must use normalized category/tag arrays and the existing Hugo front matter format.
- Existing-post updates must continue writing to the original `editingPath`, even if the title or date is edited.
- No API contract, database schema, GitHub authorization behavior, or repository path policy changes are required.

### R5: Deployment Verification

- Add regression coverage for comma parsing and the raw-input-to-canonical-array boundary.
- Run `npm test`, `npm run lint`, and `npm run build` against the corrected source.
- For the public service, rebuild and restart the Next.js process after deployment; a GitHub push alone is not considered a successful rollout.
- Manually verify in a browser that typing `日常, 心情` preserves the comma while editing and publishes two YAML list items.
- Manually verify that opening a past post and choosing `新增文章` returns to a clean editor, including the dirty-change confirmation path.

## User Interaction Scenarios

1. The author types `日常, 心情` into categories or tags. The comma remains visible while typing, and final Hugo output contains two list entries.
2. The author types a trailing comma, changes focus, and sees the value normalized without an empty YAML list item.
3. The author opens an old post, clicks `新增文章`, and receives a blank editor with current date/time and the normal publish button.
4. The author edits an old post, clicks `新增文章`, cancels the warning, and remains in the old post with all unsaved edits intact.
5. The author opens a different past post while the current editor is clean; the new post loads without a warning.

## Out of Scope

- Tag/category autocomplete, taxonomy management, or a separate chip-based editor.
- Saving drafts automatically or persisting unsaved editor state in the database.
- Changing Hugo front matter field names or repository content paths.
- Changing GitHub API routes or adding a new server endpoint.
- Treating a source push as an automatic production deployment.

## Acceptance Criteria

- [ ] ASCII and full-width commas can be entered in both fields without disappearing during typing.
- [ ] Spaces, repeated commas, and trailing commas normalize to trimmed non-empty arrays at blur and publish/update boundaries.
- [ ] Existing posts load category/tag values into editable text without losing order or values.
- [ ] `新增文章` returns the editor to a clean new-post state while preserving profile and post list.
- [ ] Dirty editor content triggers a discard confirmation before opening another post or starting a new post.
- [ ] Cancelling the confirmation leaves current editor state unchanged.
- [ ] New publishing still creates expected Hugo front matter, and existing updates still target the original path.
- [ ] Unit/regression tests cover delimiter parsing and all existing tests remain green.
- [ ] Production build succeeds and deployment instructions require rebuild/restart before browser verification.
- [ ] No new database migration or GitHub API permission is introduced.

## Implementation Boundary

The first implementation is client-side only: raw taxonomy input strings, canonicalization helpers, editor baseline tracking, and a new-post reset action. Repository, API, and database layers remain unchanged.

## Implementation Status

- Implemented raw category/tag string state and canonical parsing in `src/components/writer.tsx` and `src/lib/content.ts`.
- Implemented `新增文章`, dirty-editor confirmation, and clean-baseline tracking without adding an API or database change.
- `npm test`, `npm run lint`, and `npm run build` pass for the corrected source.
- Public browser verification and production service restart remain deployment steps; pushing source alone does not replace the running Next.js bundle.
