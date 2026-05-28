# jackjordan

This is my shrine of coastal yearning.

## What is this?

A vanilla JS web page with a real-time sky and ocean theme. The sky gradient, sun and moon positioning, wave color, ocean gradient, and footer background all track wall clock time. The moon renders at its actual current phase.

## How the theming works

Time of day is read from the browser clock. Six named themes define a sky gradient (5 stops), ocean gradient (4 stops), surface haze color, wave fill, body background color, and footer background color. Between themes, all gradient stops are linearly interpolated in JS on every update so the colors change continuously rather than snapping at boundaries.

The sun and moon travel a parametric half-ellipse arc across the sky section. The sun is a CSS pseudo-element with a layered box-shadow glow. The moon is drawn on a canvas using a semicircle-plus-terminator-ellipse algorithm keyed to the real current lunar phase, with a CSS `drop-shadow` filter for the outer glow.

The clock scrubber in the top right shows and controls the emulated time of day. Drag to preview any time; the Restore button returns to wall clock time. The four theme buttons (Dawn / Day / Dusk / Night) jump to representative times.