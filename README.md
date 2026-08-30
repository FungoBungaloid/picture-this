<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Picture This

See exactly how your art will look on the wall — before you hammer a single nail.

Photograph your wall, photograph your pictures, and hang them virtually. Every
piece is drawn at its true size in centimetres and projected onto the wall at
the right angle, so what you see is what you would get.

## Running it

Open `index.html`. That's the whole thing — one file, no build step, no
install, no server, no network. Double-click it, drag it into a browser, or
put it on any static host (it is named `index.html` so GitHub Pages will serve
it as-is). Rename it to whatever you like; nothing depends on the name.

Your photos never leave your machine. There is no backend to send them to.

## How it works

1. **Room** — upload a photo of your wall and drag the four handles onto a flat
   rectangle: where the wall meets the floor and ceiling works well. Type the
   real width of that rectangle in centimetres; the height is guessed from the
   angle of the photo, and you can correct it. A 50cm grid shows how the plane
   is being read.
2. **Art** — upload a photo of a painting, print or poster and drag the handles
   onto its corners. The photo is de-skewed into a flat picture, so you can
   shoot at an angle. Give it real dimensions, then add a mat and a frame, also
   in centimetres. Colours can be eyedroppered straight out of either photo and
   are kept in a palette.
3. **Gallery** — drag pieces from your collection onto the wall. Add guide lines
   and snap to them by centre or edge, save arrangements by name to compare
   them, and export the finished wall as a JPEG.

## Saving your work

- **Save session** keeps the project in this browser, on this device. Convenient,
  but browser storage is small and photos are big, so it can fill up.
- **Download file** writes a `.json` holding the wall, every picture and every
  saved arrangement, images included. This is the durable copy: back it up, or
  move it to another computer and open it with **Load file**.
- **Export JPEG**, in the gallery, renders the wall with everything hung on it at
  the full resolution of your original photo.

## Under the hood

The interesting part is a homography — the 3x3 transform that maps one
quadrilateral onto another. Fitting one to your four corners gives a two-way
translation between "wall coordinates" and photo pixels, which is what makes
true-to-scale placement possible. It is solved with a normalised DLT and used
three ways: flattening a photographed picture (per-pixel, bilinear), placing art
live via a CSS `matrix3d`, and re-rendering the composite for export.
