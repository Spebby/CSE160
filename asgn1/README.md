# Assignment 1

A simple paint tool to serve as an introduction to WebGL.

## Sources

This code uses code from Matsuda & Lea's ColoredPoint.js example from the "WebGL
Programming Guide". Found in
[Chapter 2](https://sites.google.com/site/webglbook/home/chapter-2/) section 5.

The drawing button produces an image I drew. The weekend I programmed this
coincided with the 25th anniversary of the LOTR films, and I was lucky enough to
watch all of them in theatres as a part of the special rerun.
![fellowship pin](fellowship.jpg)

The drawing is stored in JSON at `../assets/data/fellowshipbroach.json`. This is
then parsed at runtime to construct the broach from the polygon and polyline
tools. When I was originally sketching the shape, I layered a piece of paper
over my screen and drew under it, using the paper as a guide. So, I thought it
was more impressive to show that it _is_ possible to draw complicated shapes w/
the tools I wrote, rather than hardcoding special shapes as needed.

## Gen AI Acknowledgment

Generative AI was used in generating the HTML for the website. I provided a
screenshot of the example unstyled layout present on the assignment page, and I
asked an LLM (GPT 4) to "pretty it up" with default Bootstrap 5 classes, and
some manual direction. This screenshot included a "clear canvas" button,
"drawing mode" selection, RGB sliders, "Shape Size" & "Circle Segment Count"
sliders. I wired it up manually, and added additional content not in the
original image.

![Original Image gif](Assignment1_Animation.gif)

Additionally, some code, the polygon triangulation, is a bit beyond me at the
moment. I asked Claude to help with the implementation, and gather sources. So,
updateVerts, ensureCounterClockwise, triangulate, isEar, pointInTriangle are
written with the assistance of generative AI.

The line tool was designed after and is largely derivative of the polygon. As
such it reuses some of the code written there.
