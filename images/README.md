# Drop the pumpkin photographs in here

One file per variety, named after its slug:

```
crown-prince.jpg    casperita.jpg      warty-goblin.jpg
grizzly-bear.jpg    blue-banana.jpg    galaxy-of-stars.jpg
jill-be-little.jpg  tiny-turk.jpg      porcelain-doll.jpg
magic-lantern.jpg
```

Then, from the repository root:

```
python3 tools/prepare-photos.py images/ assets/pumpkins/
```

That cuts out the background, trims to the fruit and writes WebP under 100KB
each into `assets/pumpkins/`, replacing the placeholder illustrations. Bump
`CACHE` in `sw.js` afterwards or phones will keep serving the old artwork.

Full-size originals can stay in here; nothing in this folder is served to
visitors, so they cost nothing at the gate.

## Where the photographs must come from

**Not seed-supplier catalogue shots or stock images.** They are copyrighted,
some carry a visible copyright notice, and this is a commercial site. Either:

- **Photograph the patch's own pumpkins.** Twenty minutes on an overcast day.
  Each variety on its own, from the side, filling the frame, on something
  plain. Free, clean, and more use for identification than a catalogue shot of
  a different farm's pumpkin.
- **Or get written permission from the seed supplier.** Growers are often
  granted use of their images, and several suppliers keep a library for this.

Cutting out on an iPhone (long-press the pumpkin to lift the subject) beats
anything the script does. Save as PNG with transparency and it is passed
straight through untouched.
