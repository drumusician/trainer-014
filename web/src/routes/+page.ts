/* The app runs entirely in the browser, but this one page does not: it is
   rendered at build time. Otherwise a search engine sees an empty four-kilobyte
   shell. Everything that needs a browser sits in onMount and so does not run. */
export const prerender = true;
export const ssr = true;
