# Editor Category, Tag, and New Post Flow

## Goal

Fix two editor usability problems:

1. A comma typed in the category or tag field must remain usable while the author is entering values.
2. An author opening a past post must have an obvious way to return to a clean new-post editor.

## Confirmed Current Behavior

- `src/components/writer.tsx` renders category and tag inputs from arrays joined with `", "`.
- Each input change immediately splits the value with `listFromInput` and writes the resulting array back to metadata.
- A trailing comma is therefore removed during the same render cycle, so the author cannot continue entering a comma-delimited value naturally.
- Opening a past post sets `editingPath`, metadata, and body, but there is no action that clears editing mode and restores a new-post draft.
- Existing post updates use the original `editingPath`; changing editor metadata must not silently change that update target.

## Requirements

### R1: Category and Tag Editing

- Category and tag fields must preserve the exact in-progress text while the field has focus, including a just-typed comma and spaces.
- Do not parse and re-serialize the field on every keystroke.
- Parse the field into the canonical `string[]` metadata at a defined commit boundary: blur and immediately before preview publication or existing-post update.
- Split on ASCII comma `,` and full-width comma `，` to support Traditional Chinese keyboard input.
- Trim each value and remove empty values created by repeated or trailing delimiters.
- Preserve the entered order; do not silently deduplicate values.
- Existing loaded posts must initialize the editable text from their parsed metadata.
- A new post must start with category `全部` and no tags, while still allowing the author to edit or remove the default category.

### R2: Return to a New Post

- Provide a clearly labelled `新增文章` action in the editor when a past post is open; it may also remain visible while already in new-post mode.
- Activating `新增文章` must:
  - clear `editingPath`;
  - reset title and body to the new-post defaults;
  - set a fresh current date/time using the configured editor timezone;
  - reset draft/comments/categories/tags to the existing new-post defaults;
  - keep the signed-in user, selected repository profile, and loaded past-post list unchanged;
  - switch the primary action back to `發布到 GitHub`.
- The new-post action must not write to GitHub or the database.
- When a past post is selected, the editor must continue to highlight it and show update/delete actions until the author chooses `新增文章`.

### R3: Protect Unsaved Work

- Track whether the current editor differs from its new-post or loaded-post baseline.
- Before replacing a dirty draft by opening another past post or choosing `新增文章`, show a confirmation that unsaved changes will be discarded.
- Do not show the confirmation when the editor is clean.
- If the author cancels the confirmation, retain the current metadata, body, editing path, and input focus/state.
- A failed request to open a past post must leave the current editor unchanged.

### R4: Preserve Publishing Semantics

- Publishing a new post must use the normalized category/tag arrays and the existing Hugo front matter format.
- Updating an existing post must normalize category/tag arrays but continue writing to the original `editingPath`.
- No API contract, database schema, GitHub authorization behavior, or repository path policy changes are required for this task.

## User Interaction Scenarios

1. The author types `日常, 心情` into categories or tags. The comma remains visible while typing, and the final Hugo output contains two list entries.
2. The author types a trailing comma, changes focus, and sees the value normalized without an empty YAML list item.
3. The author opens an old post, clicks `新增文章`, and receives a blank editor with current date/time and the normal publish button.
4. The author edits an old post, clicks `新增文章`, cancels the warning, and remains in the old post with all unsaved edits intact.
5. The author opens a different past post while the current editor is clean; the new post loads without a warning.

## Out of Scope

- Tag/category autocomplete, taxonomy management, or a separate chip-based editor.
- Saving drafts automatically or persisting unsaved editor state in the database.
- Changing Hugo front matter field names or repository content paths.
- Changing the GitHub API routes or adding a new server endpoint.

## Acceptance Criteria

- [ ] ASCII and full-width commas can be entered in both category and tag fields without disappearing during typing.
- [ ] Spaces, repeated commas, and trailing commas normalize to the expected trimmed non-empty arrays at blur and publish/update boundaries.
- [ ] Existing posts load their category/tag values into editable text without losing order or values.
- [ ] `新增文章` is available from the past-post editing state and returns the editor to a clean new-post state.
- [ ] Returning to a new post preserves the selected repository profile and past-post list.
- [ ] Dirty editor content triggers a discard confirmation before opening another post or starting a new post.
- [ ] Cancelling the discard confirmation leaves the current editor state unchanged.
- [ ] New publishing still creates the expected Hugo front matter, and existing-post updates still target the original path.
- [ ] No new database migration or GitHub API permission is introduced.

## Verification

- Add unit coverage for delimiter parsing, trimming, empty-value removal, full-width comma support, and order preservation.
- Add component or browser-level coverage for comma entry, post selection, `新增文章`, dirty-state confirmation, and cancel behavior.
- Run `npm test`, `npm run lint`, and `npm run build` after implementation.
