const assert = require("node:assert/strict")
const Model = require("./Model.js")

const active = { title: "Browser", activated: true, wayland: { appId: "chromium" }, workspace: { id: 1 }, lastIpcObject: { focusHistoryID: 0 } }
const previous = { title: "Terminal", activated: false, wayland: { appId: "foot" }, workspace: { id: 2 }, lastIpcObject: { focusHistoryID: 1 } }
const old = { title: "Notes", activated: false, lastIpcObject: { class: "obsidian", focusHistoryID: 8 }, workspace: { id: 3 } }

assert.deepEqual(Model.sortedWindows([old, previous, active]), [active, previous, old])
assert.equal(Model.isCurrent(active), true)
assert.equal(Model.isCurrent({ activated: false, lastIpcObject: { focusHistoryID: 0 } }), true)
assert.deepEqual(Model.filteredWindows([active, previous, old], "foot"), [previous])
assert.deepEqual(Model.filteredWindows([active, previous, old], "notes"), [old])
assert.deepEqual(Model.sameAppWindows([active, previous, { ...active, title: "Other tab" }], active).map(function(w) { return w.title }), ["Browser", "Other tab"])
assert.equal(Model.detail(old), "obsidian · ws 3")
assert.equal(Model.label({ title: "x".repeat(161) }), "x".repeat(159) + "…")
assert.equal(Model.detail({ wayland: { appId: "x".repeat(161) } }), "x".repeat(159) + "…")

// --- focusCommand: switching to windows on other workspaces ---
// Reproduces the bug: confirming a selection previously used the native
// activate path, which focuses the window but does NOT move to its workspace,
// and the plain `focuswindow` fallback dropped the 0x address prefix, so the
// lookup silently missed. Verifies the fix always dispatches an explicit,
// workspace-switching command.
const target = { title: "Browser", address: "55ea685ceda0", workspace: { id: 5 } }
const targetHex = { title: "Browser", address: "0x55ea685ceda0", workspace: { id: 5 } }
const expected = "hyprctl dispatch \"hl.dsp.focus({ window = 'address:0x55ea685ceda0' })\" >/dev/null 2>&1 || hyprctl dispatch focuswindow \"address:0x55ea685ceda0\""

assert.ok(Model.focusCommand(target), "window with address must produce a dispatch command")
assert.equal(Model.focusCommand(target), expected, "address must be normalized with 0x prefix")
assert.equal(Model.focusCommand(targetHex), expected, "existing 0x prefix must be preserved")
assert.ok(Model.focusCommand(target).startsWith("hyprctl dispatch \"hl.dsp.focus("),
  "primary dispatch must be the workspace-switching hl.dsp.focus form")
assert.ok(Model.focusCommand(target).includes("|| hyprctl dispatch focuswindow \"address:0x55ea685ceda0\""),
  "plain focuswindow must remain as the stock-Hyprland fallback")
assert.equal(Model.focusCommand({}), null, "no address defers to native activate fallback")
assert.equal(Model.focusCommand(null), null, "no window defers to native activate fallback")
console.log("Model checks passed")

// --- MRU ordering: unranked windows (no meaningful focusHistoryID) ---
// Hyprland reports focusHistoryID: null / "" for windows not meaningfully in
// the focus history (transient/popup clients). Number(null) === 0 and
// Number("") === 0, so the old historyRank() wrongly ranked them as the
// current window (rank 0), surfacing stale windows above genuinely recent
// ones and mislabeling them as current. They must sort AFTER all ranked
// windows, in source order, and never be treated as current.
const editorCur = { title: "Editor", activated: true, lastIpcObject: { focusHistoryID: 0 }, wayland: { appId: "ed" } }
const termPrev = { title: "Term", activated: false, lastIpcObject: { focusHistoryID: 1 }, wayland: { appId: "foot" } }
const staleNull = { title: "StalePopup", activated: false, lastIpcObject: { focusHistoryID: null }, wayland: { appId: "popup" } }
const staleEmpty = { title: "Mystery", activated: false, lastIpcObject: { focusHistoryID: "" }, wayland: { appId: "unknown" } }
const staleBlank = { title: "Blank", activated: false, lastIpcObject: { focusHistoryID: " " }, wayland: { appId: "blank" } }

assert.deepEqual(
  Model.sortedWindows([termPrev, editorCur, staleNull, staleEmpty, staleBlank]).map(function(w) { return w.title }),
  ["Editor", "Term", "StalePopup", "Mystery", "Blank"],
  "unranked windows must sort AFTER ranked ones, in source order"
)

assert.equal(Model.isCurrent(staleNull), false, "null focusHistoryID must not be current")
assert.equal(Model.isCurrent(staleEmpty), false, "empty focusHistoryID must not be current")
assert.equal(Model.isCurrent({ activated: false, lastIpcObject: {} }), false, "missing focusHistoryID must not be current")
assert.equal(Model.isCurrent(editorCur), true, "activated window must be current")
assert.equal(Model.isCurrent({ activated: false, lastIpcObject: { focusHistoryID: 0 } }), true, "real rank 0 must be current")

// Keep the captured app scope even after the overlay takes focus and an
// unrelated window has a stale rank-zero IPC snapshot.
const codeCurrent = { wayland: { appId: "code" }, activated: true, workspace: { id: 4 }, lastIpcObject: { focusHistoryID: 2 } }
const codeOther = { lastIpcObject: { class: "Code", focusHistoryID: 3 }, workspace: { id: 5 } }
const staleBrowser = { wayland: { appId: "chromium" }, lastIpcObject: { focusHistoryID: 0 } }
const capturedAppId = Model.appId(codeCurrent)
codeCurrent.activated = false
const scopeWindows = [staleBrowser, codeCurrent, codeOther]
assert.deepEqual(Model.windowsForApp(scopeWindows, capturedAppId), [codeCurrent, codeOther])
assert.deepEqual(Model.windowsForApp(scopeWindows, ""), [])
assert.deepEqual(Model.sameAppWindows(scopeWindows, codeCurrent), [codeCurrent, codeOther])
console.log("Captured application scope checks passed")

// Group interleaved apps, retaining each group's MRU order and window identity.
const groupedInput = [codeCurrent, staleBrowser, previous, codeOther, active]
const grouped = Model.groupedRows(groupedInput)
assert.deepEqual(grouped.windows, [codeCurrent, codeOther, staleBrowser, active, previous])
assert.deepEqual(grouped.headers, [
  { appId: "code", count: 2 }, null,
  { appId: "chromium", count: 2 }, null,
  { appId: "foot", count: 1 }
])
assert.equal(grouped.groupCount, 3)
assert.deepEqual(groupedInput, [codeCurrent, staleBrowser, previous, codeOther, active], "grouping must not mutate MRU input")
assert.deepEqual(Model.groupedRows([]), { windows: [], headers: [], groupCount: 0 })
assert.equal(Model.groupedRows([{}, {}]).groupCount, 2, "unknown apps must remain separate")
assert.equal(Model.groupedRows([{ wayland: { appId: "__proto__" } }, { wayland: { appId: "constructor" } }]).groupCount, 2)
const filteredGroups = Model.groupedRows(Model.filteredWindows(groupedInput, "ws 5"))
assert.deepEqual(filteredGroups.windows, [codeOther])
assert.equal(filteredGroups.headers[0].count, 1, "counts describe matching windows")
console.log("Application grouping checks passed")

// Backtick cycles the highlighted app only, even in the full Super+Tab list.
const appCycleRows = [codeCurrent, codeOther, staleBrowser, previous, active]
assert.equal(Model.nextAppIndex(appCycleRows, 0, 1), 1)
assert.equal(Model.nextAppIndex(appCycleRows, 1, 1), 0, "forward wraps inside Code")
assert.equal(Model.nextAppIndex(appCycleRows, 0, -1), 1, "reverse wraps inside Code")
assert.equal(Model.nextAppIndex(appCycleRows, 1, -1), 0)
assert.equal(Model.nextAppIndex(appCycleRows, 2, 1), 4, "can cycle another highlighted app, not just the original app")
assert.equal(Model.nextAppIndex(appCycleRows, 4, -1), 2, "skips unrelated windows")
assert.equal(Model.nextAppIndex(appCycleRows, 3, 1), 3, "singleton app does not leave its group")
assert.equal(Model.nextAppIndex([{}, {}], 0, 1), 0, "unknown apps are not merged")
assert.equal(Model.nextAppIndex([], 0, 1), 0)
assert.equal(Model.nextAppIndex(appCycleRows, -1, -1), -1)
assert.equal(Model.nextAppIndex(appCycleRows, 99, 1), 99)
assert.equal(Model.nextAppIndex([codeOther], 0, -1), 0, "filtered singleton stays selected")
assert.deepEqual(appCycleRows, [codeCurrent, codeOther, staleBrowser, previous, active], "cycling does not reorder or filter the list")
console.log("Within-app cycling checks passed")
