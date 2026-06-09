---
name: bootstrap-template
description: Builds a responsive Bootstrap 5 + PHP website template using our team's standard structure. Use whenever creating or cloning a website template/layout with HTML, CSS, JavaScript, jQuery, and PHP. Applies any captured colors, fonts, and styling as an override layer on top of Bootstrap, and keeps all content as placeholders.
---

# Bootstrap Template Kit

Build a clean, reusable, easily re-brandable website template. Layout and
styling may match a reference design, but every piece of text, image, and logo
must be a placeholder so it's ready to hand to a client.

## Files to create
- config.php           -> site-wide vars defined ONCE: $site_name, $phone,
                          $address, $email.
- index.php            -> main page; includes header + footer; echoes config vars.
- includes/header.php  -> <head>, CDN links, opening responsive navbar.
- includes/footer.php  -> footer markup + closing scripts.
- assets/css/style.css -> custom styles; starts with the :root palette, ends
                          with an "Overrides" section.
- assets/js/script.js  -> jQuery + vanilla JS interactions.

## Stack & load order
- Bootstrap 5 (CDN), semantic HTML5, custom CSS, vanilla JS, jQuery (CDN).
- header: Bootstrap CSS -> Google Font (if any) -> style.css
- footer: jQuery -> Bootstrap JS bundle -> script.js

## Start style.css with the palette (one edit re-themes everything)
:root {
  --primary:   #163a8c;
  --secondary: #2aa3d6;
  --accent:    #f5a623;
  --text:      #333333;
}

## Component rules
- Navbar: real Bootstrap responsive navbar with a working mobile hamburger
  toggle. Include every nav item provided.
- Hero: Bootstrap carousel with indicators + prev/next controls if the design
  has a slider; otherwise a full-width hero section.
- Cards/sections/buttons: map to Bootstrap components; keep spacing close to
  the reference.
- Accessibility: alt text on images, aria-labels on nav/controls, semantic
  landmarks (<header>, <nav>, <main>, <footer>).

## Applying captured styling (when cloning a reference site)
If colors, fonts, shapes, or animations were captured from a reference:
- Put that custom CSS in an "Overrides" section at the BOTTOM of style.css so
  it beats Bootstrap defaults. Bootstrap handles the grid; overrides define the
  look (colors, fonts, clip-path/skew hero shapes, radius, shadows, transitions,
  @keyframes).
- Rebuild animations with clean code, never the source's own JS:
  scroll fade-in -> AOS, sliders -> Swiper or Bootstrap carousel,
  hovers/transitions -> plain CSS.

## Content rules (always)
- All text = Lorem Ipsum / generic dummy copy.
- All images/icons = placeholders (https://placehold.co/WIDTHxHEIGHT or
  https://picsum.photos/WIDTH/HEIGHT). Logo = text "Your Logo".
- Never copy the reference's logo, brand name, real images, or marketing copy.
- Mark every client-swap point with <!-- CLIENT: ... --> comments.

## Finish
Output a short BUILD SUMMARY: sections built, palette used, files created, and a
checklist of what to replace with real client content.
