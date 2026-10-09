# Brainstorm Board

Jamboard-style brainstorming boards with live sharing. Each board is a set of
fixed frames, with [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT)
as the drawing engine inside each frame.

Live app: https://collab-boards.gasocialimpact.com/

## How it works

- Each frame is a fixed 16:9 page. The view is locked to the page with
  Excalidraw's viewport lock, so there is no infinite canvas. You can zoom in
  for detail but not pan off the page or zoom out past it.
- Excalidraw supplies the tools: select and move, pen, shapes, arrows, text,
  sticky notes, eraser, images, undo and redo.
- The frame rail on the left switches frames. Drag a thumbnail to reorder.
  The + button adds a frame from a template.
- New boards start from a board template (a set of frames) and new frames from
  a frame template (SWOT, theory of change, action plan, and so on). Template
  shapes are locked so they stay put; their text stays editable. Templates are
  defined in `src/templates/`.
- Upload PDF turns each page into a frame with the page as a locked, high
  resolution image on the left and open whiteboard on the right. Portrait
  pages get a taller frame that fits the window's width and scrolls top to
  bottom, so the text is readable.
- Add image places pictures on the current frame. Pasting or dropping images
  onto the canvas works too.
- Thought clusters (right panel) add a top-to-bottom section to the frame: a
  colored prompt header, a tinted column, and starter notes. Each cluster is an
  Excalidraw frame element, so notes inside move with it; drag a cluster by its
  name.
- Boards are saved in the browser's IndexedDB on this device. Export saves a
  `.brainstorm.json` file (images included) that Open a file loads back.

## Access, folders and live sharing

- The landing page is for the owner only. The owner signs in with an emailed
  link (Supabase Auth); only addresses in the `bb_admins` table get in. There
  the owner creates boards (from templates, a PDF or an exported file),
  organizes them into folders, moves and deletes them, and copies links.
- Board links (`#b=<id>`): anyone with the link can view and edit that board,
  and nothing else. Folder links (`#f=<id>`): anyone with the link sees that
  folder's boards and can open them. Board and folder ids are 128 random bits.
- Every Excalidraw element is stored as its own row with its `version`, and
  the database keeps whichever copy is newer, so simultaneous edits merge
  instead of overwriting each other. Live changes travel over a Supabase
  Realtime broadcast channel per board; presence shows who is here, which
  frame they're on, and their cursor.
- PDF pages and images go to the public `board-files` storage bucket under
  the board's id. The bucket can't be listed except by the owner.
- Tables are closed to the public key. Everything goes through the `bb_*`
  database functions; owner-only ones check `bb_admins`.

Setup:

1. Run `supabase/schema.sql`, then `supabase/002_owner_and_folders.sql`, in the
   Supabase SQL editor, and add the owner:
   `insert into public.bb_admins (email) values ('owner@example.org');`
2. In Authentication > URL Configuration, set the Site URL to the published
   app and add it (and `http://localhost:5173/**` for development) to the
   redirect URLs.
3. Put the project URL and anon key in `.env.local`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## Develop

```bash
npm install
npm run dev
```

`npm run build` writes a static site to `dist/`. Fonts are copied from the
Excalidraw package into `public/fonts` so they load from this site rather than
a CDN.

## Deploy

The `Deploy` workflow builds the app and publishes `dist/` to GitHub Pages on
pushes to `main` that change the app (edits to Markdown, `supabase/` or
`libraries/` alone don't deploy). It reads the Supabase settings from the
repository's Actions variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
Boards live in Supabase, so creating or editing boards never needs a deploy.

## Notes

- Excalidraw is pinned to the nightly build `0.18.0-143b5b6`. The viewport
  lock and sticky notes are not in a stable release yet (latest stable is
  0.18.1). Upgrade deliberately and retest frame locking when moving off it.
