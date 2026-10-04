local directory = arg[0]:match("^(.*)/") or "."
local calls, windows, failure = {}, {}, nil
local function action(kind)
  return function(args) return { kind = kind, args = args } end
end
hl = {
  get_windows = function() return windows end,
  get_window = function(selector)
    for _, window in ipairs(windows) do
      if "address:" .. window.address == selector then return window end
    end
  end,
  dsp = { focus = action("focus"), window = { alter_zorder = action("zorder") } },
  dispatch = function(value)
    calls[#calls + 1] = value
    if value.kind == failure then return { ok = false, error = "Test dispatch failure" } end
    if value.kind == "zorder" then
      value.args.window.allowed_over_fullscreen = value.args.mode == "top"
    end
    return { ok = true }
  end,
}
local reveal = dofile(arg[1] or directory .. "/hypr/focus-and-raise.lua")
local function window(address, workspace)
  return { address = address, mapped = true, fullscreen = 0, pinned = false,
    hidden = false, workspace = { id = workspace }, allowed_over_fullscreen = true }
end
local target, left, right = window("0x1", 2), window("0x2", 2), window("0x3", 2)
local pinned, elsewhere, hidden = window("0x4", 2), window("0x5", 3), window("0x6", 2)
pinned.pinned, hidden.hidden, target.fullscreen = true, true, 1
windows = { elsewhere, left, pinned, target, right, hidden }
reveal(target)
assert(#calls == 4 and calls[1].kind == "focus")
assert(calls[2].args.window == right and calls[2].args.mode == "bottom")
assert(calls[3].args.window == left and calls[3].args.mode == "bottom")
assert(calls[4].args.window == target and calls[4].args.mode == "top")
assert(target.fullscreen == 1 and target.allowed_over_fullscreen)
assert(not left.allowed_over_fullscreen and not right.allowed_over_fullscreen)
assert(pinned.allowed_over_fullscreen and elsewhere.allowed_over_fullscreen and hidden.allowed_over_fullscreen)

calls = {}
reveal(left)
assert(#calls == 2 and calls[1].kind == "focus" and calls[2].args.mode == "top")
assert(left.allowed_over_fullscreen and target.fullscreen == 1)

calls, target.fullscreen = {}, 2
reveal(target)
assert(#calls == 2 and target.fullscreen == 2, "True fullscreen must keep existing behavior")

calls, target.fullscreen = {}, 1
reveal("address:0x1")
assert(calls[1].args.window == target and #calls == 4)

calls = {}
assert(not pcall(reveal, "address:0x0") and #calls == 0)
target.mapped = false
assert(not pcall(reveal, target) and #calls == 0)
target.mapped, failure = true, "focus"
local ok, message = pcall(reveal, target)
assert(not ok and message:match("Test dispatch failure") and #calls == 1)
calls, failure = {}, "zorder"
ok, message = pcall(reveal, target)
assert(not ok and message:match("Test dispatch failure") and #calls == 2)
print("Maximize-aware focus/raise checks passed")
