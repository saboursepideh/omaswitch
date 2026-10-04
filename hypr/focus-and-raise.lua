local function dispatch(action)
  local result = hl.dispatch(action)
  assert(result.ok, result.error or "Window focus/raise action failed")
end

return function(window)
  if type(window) == "string" then window = hl.get_window(window) end
  assert(window and window.mapped, "Cannot focus a window that is no longer mapped")
  local workspace = assert(window.workspace, "Cannot focus a window without a workspace")

  dispatch(hl.dsp.focus({ window = window }))
  if window.fullscreen == 1 then
    local windows = hl.get_windows({ mapped = true })
    -- Lower in reverse order to preserve the siblings' relative stacking.
    for index = #windows, 1, -1 do
      local other = windows[index]
      if other.address ~= window.address and not other.pinned and not other.hidden
        and other.workspace and other.workspace.id == workspace.id then
        dispatch(hl.dsp.window.alter_zorder({ mode = "bottom", window = other }))
      end
    end
  end
  dispatch(hl.dsp.window.alter_zorder({ mode = "top", window = window }))
end
