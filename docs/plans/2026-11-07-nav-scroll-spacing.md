# Keep navigation placement stable

Keep the desktop navigation 16px from the viewport top during scrolling. Match
Sign in to the other text links, removing the nested outline and excess trailing
spacing. Preserve the mobile header and signed-in account controls.

Check the desktop navigation bounding rectangle before and after scrolling,
inspect tablet and mobile layouts, run npm run check and a production build.
