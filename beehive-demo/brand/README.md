# beehive logo

The beehive bee, Buzzy, and the animated BEEHIVE logo.

## Animated logos (for websites and apps)

| File | What happens |
|---|---|
| `animated/beehive-arrive-trail.svg` | The bee zig-zags in and BEEHIVE drops in as it passes (recommended) |
| `animated/beehive-arrive-loop.svg` | The bee does a loop-the-loop, then BEEHIVE pops in |
| `animated/beehive-arrive-drop.svg` | The bee floats down, then BEEHIVE jumps up |
| `animated/beehive-arrive-switch-on.svg` | The bee spirals in, then BEEHIVE flickers on like neon |
| `animated/beehive-anim-loader.svg` | A hovering bee for loading screens |

GIF and MP4 versions for slides, chat and social media are in `previews/`.

## Static files

- `static/beehive-bee.svg`: the bee on its own
- `static/beehive-app-icon.svg`: app icon
- `static/favicon.svg`: browser tab icon

## How to use

```html
<img src="animated/beehive-arrive-trail.svg" alt="beehive" width="220">
<link rel="icon" type="image/svg+xml" href="static/favicon.svg">
```

From another site, once this branch is merged and deployed:

```html
<img src="https://big-mother-beehive-demo.vercel.app/brand/animated/beehive-arrive-trail.svg" alt="beehive" width="220">
```

The animation is built into each SVG file; no JavaScript is needed. It stays still for people whose devices are set to reduce motion.

**Colours:** Honey `#F2B127` · Night `#2B2440` · Wing `#E3F3FF` · Cream `#FFF8EC`
