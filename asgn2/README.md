# Assignment 2

A 3D animation of an animal, powered by WebGL.

I make use of a transform wrapper to simplify the creation of complex meshes,
though this adds slight overhead. Performance is not bad enough to justify it,
but a dirty flag would be a good optimisation, which I briefly considered.

For debug visualisation... what's with it? I wanted to display the skeleton in
order to make animating and lining things up a little easier. Red nodes are
parents nodes, whereas green nodes are end-nodes. All end-nodes are mesh
transforms which are parented to the red pivot nodes.

## Sources

[Blinn-Phong Shading](https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_reflection_model) -
I used a modified version of this lighting technique for my scene's lighting. I
used the example OpenGL code as a base.

## Gen AI Acknowledgment

As with assignment 0 & 1, the HTML was written w/ the help of gen AI, as I
reused the HTML between each assignment.

I used Gen AI to write some of the more tedious functions, namely
`makeUnitCylinder` (though this required a lot of manual tweaking), and
`generateNormals`. I also used it to adapt my previous assignment's shader code
to support basic lighting, based on Blinn Phong. I used
[Wikipedia's OpenGL code](https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_reflection_model)
as a reference. I did this to make animating easier, as figuring out where
joints started and ended in full bright was tedious. On the lighting model
itself: it's greatly simplified: lighting is only directional, the same distance
attenuation is not present. I also skipped the specular lighting step. I don't
care for specular much, and it looks weird on a furry animal anyway.

I also used it for rubber ducking while working on camera code and to detect
bugs and errors with my logic. Which took quite awhile.
