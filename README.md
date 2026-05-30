# Hello.

This is my shrine of coastal yearning. And also the sky, I guess.

## What is this?

A vanilla JS web page with a sky and ocean that follow the real time of day and year. The gradients, the sun and moon positions, planet visibility, wave color, and footer tint all track the actual sun and moon for the current date, seen from one fixed vantage point. The moon renders at its true current phase, the days lengthen and shorten with the seasons, and dawn/twilight begins when it actually should.

## How the theming works

Time of day is read from the browser clock, but the meaning of that time comes from astronomy. For the current date and location (35° N, 120° W), the page computes real sunrise, sunset, and solar noon, then builds the day around them. Six named themes (dawn, day, dusk, evening, night, midnight) define a sky gradient (five stops), an ocean gradient (four stops), a surface haze tint, and a wave fill. Between themes, every stop is linearly interpolated in JS on each update, so the colors slide continuously instead of snapping at boundaries.

The full-height page background is anchored to the live edges of the scene. Its top matches the exact color at the very top of the sky and its bottom matches the deepest stop of the ocean, so an overscroll bounce at either end reveals the color it should.

## Twilight and day length

The transitions between night and day sit at real twilight boundaries rather than fixed offsets. For the current date, the code solves for the moments the sun passes 18°, 12°, and 6° below the horizon (astronomical, nautical, and civil twilight) and anchors the dawn and dusk there. Because those crossings shift throughout the year, so do the bands; astronomical twilight stretches to nearly two hours around the summer solstice and tightens toward the equinoxes. Pure day and pure night then expand and contract to fill whatever is left between them.

## The sun and moon

The sun and moon travel parametric half-ellipse arcs across the sky section. The sun is a CSS pseudo-element with a layered box-shadow glow. The moon is drawn on a canvas with a semicircle-plus-terminator-ellipse algorithm keyed to the real current phase, finished with a CSS `drop-shadow` for the outer glow.

The sun rises and sets at its real times and crests at a height set by its actual noon elevation, so it rides high in summer and stays low and flat in winter. The moon keeps its own schedule entirely: it runs on its real rise, set, and transit altitude, drifts about fifty minutes later each night, climbs to a height set by its own declination (high one week, low the next), and can linger in the daytime sky as a pale disc that brightens as the evening comes.

## Planets

Venus, Mars, Jupiter, and Saturn are rendered on the sky canvas when they are above the horizon and in the western section of the sky, as seen from Coastal California (35° N, 120° W). Positions are computed from simplified Keplerian orbital elements using the NASA JPL approximation, accurate to roughly one arc-minute over the range 1800 to 2050. Each planet fades with the sky as daylight increases, matching the behavior of the stars.

## The clock scrubber

The clock scrubber in the top right shows and controls the emulated time of day. Drag to preview any time and press Restore to return to the wall clock. The four theme buttons (Dawn / Day / Dusk / Night) jump to representative times spaced six hours apart.

Dragging the clock hand past midnight advances or retreats the calendar date, shown in a pill beneath the clock face and hidden when the date matches today. Restore resets the date offset and time deviation to present.