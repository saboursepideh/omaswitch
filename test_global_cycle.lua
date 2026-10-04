local directory = arg[0]:match("^(.*)/") or "."
local keys, sent, callback, timer = {}, {}, nil, { enabled = false }
function timer:set_enabled(value) self.enabled = value end
hl = {
  timer = function(fn, options)
    assert(options.timeout == 16 and options.type == "repeat")
    callback = fn
    return timer
  end,
  is_key_down = function(key) return keys[key] == true end,
  dsp = { global = function(name) return name end },
  dispatch = function(name) sent[#sent + 1] = name end,
}
local factory = dofile(arg[1] or directory .. "/hypr/global-shortcut-cycle.lua")
local oma, workspace = factory("omaswitch"), factory("workspace-selector")
keys.Super_L, keys.F1 = true, true
workspace("next", "F1")()
callback()
assert(#sent == 1 and sent[1] == "workspace-selector:next")
keys.F1 = false
callback()
keys.F1, keys.Shift_R = true, true
callback()
assert(sent[2] == "workspace-selector:previous")
keys.Super_L = false
callback()
assert(sent[3] == "workspace-selector:commit" and not timer.enabled)
oma("current-next", "grave")()
callback()
assert(sent[4] == "omaswitch:current-next" and sent[5] == "omaswitch:commit")
keys.Super_R = true
workspace("previous", "F1")()
oma("next")()
keys.Super_R = false
callback()
assert(sent[6] == "workspace-selector:previous")
assert(sent[7] == "omaswitch:next" and sent[8] == "omaswitch:commit")
print("Shared global shortcut release guard checks passed")
