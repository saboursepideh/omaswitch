var maxDisplayLength = 160

function boundedText(value) {
  value = String(value || "")
  return value.length > maxDisplayLength ? value.slice(0, maxDisplayLength - 1) + "…" : value
}

function appId(window) {
  if (!window) return ""
  if (window.wayland && window.wayland.appId) return String(window.wayland.appId)
  var ipc = window.lastIpcObject || {}
  return String(ipc.class || ipc.initialClass || "")
}

function label(window) {
  return boundedText(window && window.title ? window.title : (appId(window) || "Untitled"))
}

function detail(window) {
  if (!window) return ""
  var value = appId(window)
  if (window.workspace) value += (value ? " · " : "") + "ws " + String(window.workspace.id)
  return boundedText(value)
}

// Hyprland's focusHistoryID is a rank in the compositor's global focus-history
// list: 0 = currently focused, 1 = most recent before that, ascending = older.
// Transient/popup windows not meaningfully in that history can report null or
// an empty string. Number(null) === 0 and Number("") === 0, so we must guard
// before coercion — otherwise such windows are ranked 0 (treated as current)
// and surface above genuinely recent ones.
function historyRank(window) {
  var ipc = window && window.lastIpcObject ? window.lastIpcObject : {}
  var raw = ipc.focusHistoryID
  if (raw === null || raw === undefined) return 1000000
  // "" and " " both coerce to 0; discard empty/whitespace values (transient
  // windows not meaningfully in the focus history).
  if (typeof raw !== "number" && String(raw).trim() === "") return 1000000
  var rank = Number(raw)
  return isFinite(rank) && rank >= 0 ? rank : 1000000
}

function isCurrent(window) {
  return !!(window && window.activated) || historyRank(window) === 0
}

function focusRank(window) {
  return isCurrent(window) ? -1 : historyRank(window)
}

function sortedWindows(values) {
  var source = values && typeof values.slice === "function" ? values.slice() : []
  var decorated = []
  for (var i = 0; i < source.length; i++) decorated.push({ value: source[i], index: i })
  decorated.sort(function(left, right) {
    return focusRank(left.value) - focusRank(right.value) || left.index - right.index
  })
  var result = []
  for (var j = 0; j < decorated.length; j++) result.push(decorated[j].value)
  return result
}

function filteredWindows(values, query) {
  var q = String(query || "").trim().toLowerCase()
  if (!q) return values.slice()
  return values.filter(function(window) {
    return (label(window) + " " + detail(window)).toLowerCase().indexOf(q) !== -1
  })
}

function sameAppWindows(values, reference) {
  return windowsForApp(values, appId(reference))
}

// Cycle only among visible windows of the highlighted app, without changing
// the list's scope or filter. A singleton/unknown app keeps its selection.
function nextAppIndex(values, selectedIndex, delta) {
  if (selectedIndex < 0 || selectedIndex >= values.length) return selectedIndex
  var id = appId(values[selectedIndex]).toLowerCase()
  if (!id) return selectedIndex
  var direction = delta < 0 ? -1 : 1
  for (var offset = 1; offset < values.length; offset++) {
    var index = (selectedIndex + direction * offset + values.length) % values.length
    if (appId(values[index]).toLowerCase() === id) return index
  }
  return selectedIndex
}

// Input is already in MRU order. Order groups by their first (most recent)
// window and preserve MRU order within each group. Never merge unidentified
// windows into one fictitious application.
function groupedRows(values) {
  var groups = []
  values.forEach(function(window) {
    var id = appId(window)
    var key = id.toLowerCase()
    var group = key ? groups.find(function(candidate) { return candidate.key === key }) : null
    if (!group) {
      group = { key: key, appId: id, windows: [] }
      groups.push(group)
    }
    group.windows.push(window)
  })
  var windows = [], headers = []
  groups.forEach(function(group) {
    group.windows.forEach(function(window, index) {
      windows.push(window)
      headers.push(index === 0 ? { appId: group.appId, count: group.windows.length } : null)
    })
  })
  return { windows: windows, headers: headers, groupCount: groups.length }
}

function windowsForApp(values, applicationId) {
  var id = String(applicationId || "").toLowerCase()
  if (!id) return []
  return values.filter(function(window) {
    return appId(window).toLowerCase() === id
  })
}

// Build the shell command that focuses a window AND moves to its workspace.
// Native toplevel activate does not always switch the visible workspace, so
// the switch is requested explicitly: prefer Omarchy's Lua dispatcher form
// (hl.dsp.focus), fall back to the plain focuswindow syntax for stock
// Hyprland. Returns null when the window has no address, deferring to the
// native activate path in Switcher.qml.
function focusCommand(window) {
  var raw = window && window.address
  if (raw === null || raw === undefined || raw === "") return null
  var rawAddress = String(raw)
  var address = rawAddress.indexOf("0x") === 0 ? rawAddress : "0x" + rawAddress
  return "hyprctl dispatch \"hl.dsp.focus({ window = 'address:" + address +
    "' })\" >/dev/null 2>&1 || hyprctl dispatch focuswindow \"address:" + address + "\""
}

if (typeof module !== "undefined") module.exports = {
  appId: appId,
  label: label,
  detail: detail,
  isCurrent: isCurrent,
  sortedWindows: sortedWindows,
  filteredWindows: filteredWindows,
  sameAppWindows: sameAppWindows,
  nextAppIndex: nextAppIndex,
  groupedRows: groupedRows,
  windowsForApp: windowsForApp,
  focusCommand: focusCommand
}
