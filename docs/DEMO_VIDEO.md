# Demo video: 60 seconds (W6 script, shot/edited in P3)

The script, the shots, the voiceover and the caption, written against what the
live site actually does on the day it is recorded. Nothing here requires a
feature that does not exist.

Recording notes:

- Screen 1280x800 minimum. System theme **light** (bright, flat, readable on
  the map canvas). Frame rate 30+, no motion blur.
- No music bed louder than the voiceover; captions on.
- The hero, story and blast-radius shots use the landing page's **labelled demo
  map** (26 files mirroring Vorza's own layout). The connect shot uses any real
  GitHub repo the demo account can open; if there is none, cut to the landing
  review card instead and say so in the caption.
- No cut takes longer than 15 seconds. Total target 58-62 seconds.
- Voiceover reads the left column; on-screen action is the right column.

| # | Time | Voiceover | On screen |
|---|---|---|---|
| 1 | 0:00-0:06 | "Every repo is a map. Every file is a node, sized by how much of the codebase depends on it, coloured by its health score. This is Vorza." | Hero of the landing page; cursor pans slowly left to right across the demo map; the 01 Survey label holds. |
| 2 | 0:06-0:18 | "Scroll, and the map zooms into the story: clusters are packages, hubs are the files everything imports, outliers are the files worth reading first." | Scroll-zoom story; three beats, one per sentence. Beat labels (Reading the map 01/03, 02/03, 03/03) visible. |
| 3 | 0:18-0:30 | "Hover any file and the map shows its blast radius: every file that imports it. That is the set a change to this file drags along." | Blast radius section; hover a backend hub file, hold 2s so the dependents pulse, then release. |
| 4 | 0:30-0:42 | "Connect a GitHub repo and Vorza builds the same map from your code, then scores every file the same way." | Connect a repo flow: Sign in, GitHub OAuth consent page (pause on the scope list), dashboard, open a repo map. |
| 5 | 0:42-0:52 | "Pull requests get read before you do. A webhook sends the diff to a model that has to show its working: every flag carries a file and a line, and findings that cannot be cited are dropped." | Review page: risk score chip, then hover each flagged file so its path and line chips highlight. |
| 6 | 0:52-0:60 | "Free tiers, real stack, open source. Vorza, the living, AI-reviewed map of your codebase. Linked below." | Hold on the review card; fade to the Vorza wordmark; then end card with vorza-sigma.vercel.app. |

## Fallbacks

- If the demo account cannot be provisioned before the shoot, scene 4 becomes a
  shot of the landing review card (04 Pull requests get read) and the VO line
  says "the review card on the landing is a sample, and the map rendering on
  this page is live." Do not fake the connect flow.
- Scene 3 needs a file with dependents in the demo map. The demo dataset is
  deterministic (seeded positions), so `backend/app/*/orchestrator.py` and the
  frontend `app/` entry files always have dependents; hover one of those.

## Caption (pinned comment, first line)

> Vorza turns a GitHub repo into a live map of every file, scored for
> complexity, churn and health, with AI PR reviews that cite the lines they
> flag. Free tiers: Render + Vercel + Neon. Source: linked. Repos in the
> opening shots are a demo map, not a customer.

## Where the numbers in the 06 Field notes strip came from

Recorded at the time of shooting, from the repo, not the video: 172 backend
tests, 127 frontend tests, 81% backend coverage, deployed on Render + Vercel +
Neon. If the numbers have moved, re-run the counts and re-render the strip
before cutting the end card.