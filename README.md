# Hello.

This is my shrine of coastal yearning. And also the sky, I guess. 

## What is this?

A vanilla JS web page with real-time celestial body movement and sky/ocean themes. The gradients, sun and moon positioning, planet visibility and positioning, wave color, and footer tint all track wall clock time. The moon renders at its actual current phase.

## How the theming works

Time of day is read from the browser clock. Six named themes define a sky gradient (five stops), ocean gradient (four stops), surface haze color, wave fill, body background color, and footer background color. Between themes, all gradient stops are linearly interpolated in JS on every update so the colors change continuously rather than snapping at boundaries.

The sun and moon travel a parametric half-ellipse arc across the sky section. The sun is a CSS pseudo-element with a layered box-shadow glow. The moon is drawn on a canvas using a semicircle-plus-terminator-ellipse algorithm keyed to the real current lunar phase, with a CSS `drop-shadow` filter for the outer glow.

The clock scrubber in the top right shows and controls the emulated time of day. Drag to preview any time and press the Restore button to return to real time. The four theme buttons (Dawn / Day / Dusk / Night) jump to representative times spaced six hours apart. Dragging the clock hand past midnight advances or retreats the calendar date, shown below the clock face.

## Planets

Venus, Mars, Jupiter, and Saturn are rendered on the sky canvas when they are above the horizon and in the western semicircle of the sky, as seen from Coastal California (36° N, 121° W). Positions are computed from simplified Keplerian orbital elements using the NASA JPL approximation, accurate to roughly one arc-minute over the range 1800 to 2050. Each planet fades with the sky as daylight increases, matching the behavior of the stars.

## Date advancement

The scrubber clock tracks calendar date in addition to time of day. Each time the clock hand crosses midnight, the displayed date increments or decrements by one day. The current date offset is shown in a pill beneath the clock face and is hidden when the date matches today. Planetary positions update to match the displayed date in real time as the hand is dragged. The Restore button clears the date offset along with the time deviation.