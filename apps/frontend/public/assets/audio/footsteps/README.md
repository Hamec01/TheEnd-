# Footstep Audio Pack

Add step sounds into the surface folders below.

Expected file names:

- `field/step_1.ogg`, `field/step_2.ogg`, `field/step_3.ogg`
- `road/step_1.ogg`, `road/step_2.ogg`, `road/step_3.ogg`
- `sand/step_1.ogg`, `sand/step_2.ogg`, `sand/step_3.ogg`
- `swamp/step_1.ogg`, `swamp/step_2.ogg`, `swamp/step_3.ogg`
- `snow/step_1.ogg`, `snow/step_2.ogg`, `snow/step_3.ogg`

Current runtime mapping:

- `road` region -> `road`
- `sand` region -> `sand`
- `swamp` or `water` region -> `swamp`
- snow-like kingdom id/name (contains `snow` or `снег`) -> `snow`
- everything else -> `field`

You can replace OGG with another browser-safe format, but then update source paths in world map runtime.
