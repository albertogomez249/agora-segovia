# Venue photographs

Drop a photograph in this folder and the venue has a picture — in the map list,
on the venue sheet, and on every offer that belongs to it. There is nothing to
register and no code to change: `/api/photos` is a listing of this directory,
and anything not in here falls back to the generated pattern.

Six of the forty-six testers on 23 November asked for pictures of the places,
which made it the most repeated request about the catalogue. Two of them said
in as many words that they would not use a listing they could not picture.

## The filename is the venue name, flattened

Lower case, accents stripped, anything that is not a letter or a digit becomes
a hyphen. `.jpg`, `.jpeg`, `.png`, `.webp` and `.avif` all work.

| Venue | File to add |
|---|---|
| Mesón de Cándido | `meson-de-candido.jpg` |
| Restaurante José María | `restaurante-jose-maria.jpg` |
| Mesón Duque | `meson-duque.jpg` |
| La Casa del Siglo XV | `la-casa-del-siglo-xv.jpg` |
| Limón y Menta | `limon-y-menta.jpg` |
| C.C. Luz de Castilla | `c-c-luz-de-castilla.jpg` |
| Alcázar de Segovia | `alcazar-de-segovia.jpg` |
| Gimnástica Segoviana CF | `gimnastica-segoviana-cf.jpg` |
| Teatro Juan Bravo | `teatro-juan-bravo.jpg` |
| Cines Artesiete Segovia | `cines-artesiete-segovia.jpg` |
| Pádel Segovia | `padel-segovia.jpg` |
| Zibá | `ziba.jpg` |

Add a venue later and the rule is the same: take its name, flatten it. If a
photo does not appear, the filename is wrong — check it against this table
rather than the code.

## What is actually in here today

Four real photographs of four of these venues, taken from Wikimedia Commons
under licences that permit reuse. They are the actual buildings, not stand-ins:

| Venue | Photographer | Licence |
|---|---|---|
| Mesón de Cándido | Zarateman | CC0 |
| Alcázar de Segovia | Rafa Esteve | CC BY-SA 4.0 |
| Teatro Juan Bravo | Barcex | CC BY-SA 3.0 |
| Gimnástica Segoviana CF (Estadio de La Albuera) | Cajarines | CC BY-SA 4.0 |

`credits.json` holds the author, licence and source link for each, `/api/photos`
serves them alongside the file list, and the app prints the credit under the
picture. **CC BY-SA is not "free to take" — it is free on condition that the
photographer is named.** A photograph whose credit goes missing is a licence
being broken, not an untidy caption, so the credit travels with the file rather
than living in a document nobody opens.

### The other eight have no photograph, and that is not an oversight

Restaurante José María, Mesón Duque, La Casa del Siglo XV, Limón y Menta,
C.C. Luz de Castilla, Cines Artesiete, Pádel Segovia and Zibá. I looked: there
is no freely-licensed photograph of any of them. The options for those are to
photograph them ourselves or to ask the venue — and nothing else, because the
two tempting shortcuts are both dishonest. Lifting a picture from a venue's
own website or from Google is taking someone's copyrighted work. Putting a
stock photograph of *some* restaurant under the name of a real, named
restaurant is worse: it is a picture that claims to be a place it is not, in
an app whose entire premise is that students can trust what they are told
about a venue before they walk to it.

So those eight keep the generated pattern, which claims nothing.

## Shooting them

These are **our own photographs**, taken in Segovia. That matters for two
reasons. Google's Places photos cannot be stored, need a billed API key and are
charged per view, which is a poor dependency for something demonstrated live.
And a photograph we took is one we can honestly caption.

- **Landscape, roughly 3:2.** The frame is cropped to fill, so leave air around
  the subject. Nothing important in the last 15% at the bottom: a gradient and
  the venue's name sit there on the sheet.
- **About 1600px wide, under 300KB.** These load on campus wifi. Export at
  quality 70–75; `.webp` is smaller than `.jpg` at the same quality.
- **The outside, in daylight**, for anywhere a student has to find on foot —
  the door they are looking for, with enough street to recognise it.
  For the cinema, the theatre and the club, the inside says more.
- **No people whose face is identifiable**, unless you asked them. The backs of
  heads in a bar are fine and make a room look alive; a recognisable face is
  personal data and we would be publishing it.
- **Ask inside before shooting inside.** The street is public, the dining room
  is not. If they say no, the exterior is enough.

## What these photographs do not mean

A photograph of a venue is not a claim that the venue is part of Ágora. None of
these businesses has agreed to anything, every discount in the prototype is
invented, and the demonstration notice on the student app and on the website
says so. Keep it that way: no logos, no signage mocked up to look like a
partnership, nothing that could be read as an endorsement they never gave.
