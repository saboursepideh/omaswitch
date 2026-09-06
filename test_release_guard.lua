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
local cycle = dofile(directory .. "/hypr/omaswitch-cycle.lua")
assert(not timer.enabled)
keys.Super_L = true
cycle("current-next")()
assert(sent[1] == "omaswitch:current-next" and timer.enabled)
callback() -- Backtick released, Super still down: do not commit.
assert(#sent == 1 and timer.enabled)
keys.Super_R = true
keys.Super_L = false
callback() -- Keep cycling if the other Super key is still down.
assert(#sent == 1 and timer.enabled)
keys.Super_R = false
callback() -- No QML release event is necessary.
assert(sent[2] == "omaswitch:commit" and not timer.enabled)
cycle("current-previous")()
callback() -- Fast tap: Super already up at the first check.
assert(sent[3] == "omaswitch:current-previous")
assert(sent[4] == "omaswitch:commit" and not timer.enabled)
print("OmaSwitch release guard checks passed")