local directory = debug.getinfo(1, "S").source:sub(2):match("^(.*)/") or "."
return dofile(directory .. "/global-shortcut-cycle.lua")("omaswitch")