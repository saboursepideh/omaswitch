-- Native release guard: keyboard-focus changes and shortcut inhibition cannot
-- hide the compositor's physical key state. No subprocesses or release binds.
local release_guard
release_guard = hl.timer(function()
  if hl.is_key_down("Super_L") or hl.is_key_down("Super_R") then
    return
  end
  release_guard:set_enabled(false)
  hl.dispatch(hl.dsp.global("omaswitch:commit"))
end, { timeout = 16, type = "repeat" })
release_guard:set_enabled(false)

return function(shortcut)
  return function()
    -- Both messages use the same native protocol, so commit follows summon
    -- even if Super is released before Quickshell processes the summon.
    hl.dispatch(hl.dsp.global("omaswitch:" .. shortcut))
    release_guard:set_enabled(true)
  end
end