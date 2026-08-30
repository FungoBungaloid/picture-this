<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Picture This

Photograph your wall, hang your art on it, and walk away with the measurements
you need to put the nails in the right place.

Everything is drawn at its true size in centimetres and projected onto your
photo at the angle the camera saw it, so what you see is what you would get.

## Running it

Open `index.html`. That's the whole thing — one file, no build step, no install,
no server, no network. Double-click it, drag it into a browser, or put it on any
static host. Your photos never leave the tab; there is no backend to send them to.

## The workflow

**1 · The wall.** Upload a photo and drag four dots onto a rectangle you can
measure — where the wall meets the floor and ceiling works well. Type its real
width; the height is worked out from the angle of the photo, and you can correct
it. Say how far that bottom edge sits above the floor, and every height in the
app becomes a height above your actual floor. A 50 cm grid overlay tells you
whether the corners are honest, and a loupe magnifies the pixels under your
thumb while you place them. Projects can hold several walls.

**2 · The art.** Photograph a picture from wherever you're standing; the crop
step de-skews it flat. Give it real dimensions — or start from a paper size —
then add a mat and a frame in centimetres, from a preset or by hand. Colours can
be eyedroppered out of either photo and are kept in a palette. Record the hook
drop (wire pulled taut, measured down from the top of the frame) and the nail
heights account for it.

Not bought it yet? **Add a blank panel** at the size you're considering and see
whether it works on the wall before you spend anything.

**3 · The wall itself.** Drag pieces from your collection. They snap to each
other's edges and centres, to the middle of the wall, to eye level and to guide
lines you place — all in real centimetres, so a snap means the pieces genuinely
line up. Select several and align or space them evenly with a stated gap. Type
exact positions when you'd rather not drag. A ruler runs up the left edge with
the floor and eye level marked.

**4 · The plan.** The point of the exercise: a table of nail heights and across
positions, printable with a marked-up photo of the wall, or copied as text for
your phone. Heights are from the floor, across is from the left edge of the area
you calibrated.

## Keyboard

| | |
|---|---|
| Arrow keys | nudge 1 cm (hold shift for 10) |
| `Ctrl/Cmd` + `Z` / `⇧Z` | undo / redo placement |
| `Ctrl/Cmd` + `D` | duplicate |
| `Ctrl/Cmd` + `A` | select everything on the wall |
| `Ctrl/Cmd` + `S` | save the session |
| `⇧` click | add to the selection |
| `Delete` | take the selection down |
| `Esc` | leave a field, or clear the selection |

## Saving

- **Save** keeps the project in this browser, on this device. Photos are
  downscaled on the way in so this usually fits, but browser storage is small.
- **Export ▸ Project file** writes a `.json` holding every wall, every picture and
  every saved arrangement, images included. That is the copy worth keeping, and
  the one to move between computers. Files written by the first version still open.
- **Export ▸ Photo** renders the wall at the resolution of your original
  photograph, with or without the measurements marked on it.

Undo covers placement, sizing and framing. Adding or deleting an artwork is not
undoable, which is why deleting asks first.

## Design notes

A few decisions worth explaining, since they were deliberate.

**The interface is neutral grey on purpose.** An earlier version was blue-tinted,
which is a genuine problem in an app whose job is judging how colours look
together: a saturated surround shifts your perception of the artwork inside it.
Photo tools are grey for the same reason. The one accent is brass, kept for
actions and active states, and cyan and magenta are reserved for measurement
lines so they can never be mistaken for part of a picture.

**Everything is a length, not a pixel.** Snapping, alignment, guides and the plan
all work in centimetres on the wall plane, then get projected into the photo.
That's why a snap means two frames really do line up, rather than merely looking
aligned from where the camera stood.

**Inches are a display skin.** Centimetres are stored; inches are formatted to
the nearest eighth in readouts, because that is how a tape measure is read.

**Labels are drawn with a dark outline** under the glyphs, so they stay readable
whether your wall is white plaster or navy paint.

## Under the hood

The interesting part is a homography — the 3×3 transform mapping one
quadrilateral onto another. Fitting one to your four corners gives a two-way
translation between wall centimetres and photo pixels, which is what makes
true-to-scale placement possible. It's solved with a normalised DLT and used
four ways: flattening a photographed picture (per-pixel, bilinear), placing art
live via a CSS `matrix3d`, converting pointer positions back into wall
coordinates, and re-rendering the composite for export. It also extrapolates
cleanly past the rectangle you marked, which is how the floor line can be drawn
below the area you calibrated.
