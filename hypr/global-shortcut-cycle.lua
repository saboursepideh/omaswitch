local cycle_key, cycle_shortcut, cycle_namespace, cycle_key_down
local release_guard
release_guard = hl.timer(function()
  if hl.is_key_down("Super_L") or hl.is_key_down("Super_R") then
    if cycle_key then
      local down = hl.is_key_down(cycle_key)
      if down and not cycle_key_down then
        local shortcut = cycle_shortcut
        if hl.is_key_down("Shift_L") or hl.is_key_down("Shift_R") then
          shortcut = shortcut:gsub("next$", "previous")
        else
          shortcut = shortcut:gsub("previous$", "next")
        end
        hl.dispatch(hl.dsp.global(cycle_namespace .. ":" .. shortcut))
      end
      cycle_key_down = down
    end
    return
  end
  release_guard:set_enabled(false)
  local namespace = cycle_namespace
  cycle_key, cycle_shortcut, cycle_namespace, cycle_key_down = nil, nil, nil, false
  hl.dispatch(hl.dsp.global(namespace .. ":commit"))
end, { timeout = 16, type = "repeat" })
release_guard:set_enabled(false)

return function(namespace)
  return function(shortcut, key)
    if key and key:lower() == "grave" then key = nil end
    return function()
      cycle_key, cycle_shortcut, cycle_namespace, cycle_key_down = key, shortcut, namespace, true
      -- Compositor key state catches release even before the popup is shown.
      hl.dispatch(hl.dsp.global(namespace .. ":" .. shortcut))
      release_guard:set_enabled(true)
    end
  end
end
