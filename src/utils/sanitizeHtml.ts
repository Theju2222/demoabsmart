import sanitize from "sanitize-html";

// isomorphic-dompurify (previous implementation) sanitizes server-side via
// jsdom, which crashes on Vercel's serverless runtime with an ESM/CJS
// require() error — it never surfaced while these pages were bailing to
// client-only rendering (see the CSR-bailout fix, 2026-08-25), but now that
// SSR actually runs, every dangerouslySetInnerHTML call site using this util
// hit it. sanitize-html is pure string parsing (no DOM/jsdom dependency),
// so it works the same on server and client and on any runtime.
//
// Widened past sanitize-html's defaults: <img> (product/CMS descriptions
// embed images) plus class/style on the common tags admin-authored HTML
// actually uses, so this doesn't strip formatting DOMPurify's html profile
// allowed. <script>/event handlers/javascript: URLs are still never allowed
// — that's the XSS protection this exists for.
//
// `style` is allowlisted as a plain attribute with parseStyleAttributes:
// false below — sanitize-html then leaves its value untouched instead of
// parsing it into a property allowlist. A per-property allowlist (the
// earlier approach here) always lags behind whatever properties admin-authored
// HTML actually uses (border/padding/display/table layout/etc. all had to be
// added by hand and still didn't cover everything), so admin-panel previews
// never matched the storefront exactly. `style` itself can't carry <script>
// or event handlers — the real XSS surface for this content — and those are
// still blocked by ALLOWED_TAGS/ALLOWED_ATTRIBUTES/ALLOWED_SCHEMES_BY_TAG
// below, which is what actually matters for this string-only CMS field.
const ALLOWED_TAGS = [...sanitize.defaults.allowedTags, "img"];
const ALLOWED_ATTRIBUTES = {
  ...sanitize.defaults.allowedAttributes,
  "*": ["class", "style"],
  // data: is on top of the defaults (http/https/ftp/mailto/tel) so inline
  // base64 images survive — common output from paste-an-image-into-the-CMS
  // editor flows, and the whole reason `img` was added above.
  img: [...(sanitize.defaults.allowedAttributes.img ?? []), "class", "style"],
};
const ALLOWED_SCHEMES_BY_TAG = { img: [...sanitize.defaults.allowedSchemes, "data"] };

/**
 * Sanitize API/CMS-provided HTML before injecting it via
 * dangerouslySetInnerHTML. Strips <script>, event handlers, javascript:
 * URLs, etc. — blocks stored XSS if the admin/API content is compromised.
 *
 * Returns an object ready to spread into dangerouslySetInnerHTML:
 *   <div dangerouslySetInnerHTML={sanitizeHtml(apiHtml)} />
 */
export const sanitizeHtml = (dirty: string | null | undefined): { __html: string } => ({
  __html: sanitize(dirty ?? "", {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemesByTag: ALLOWED_SCHEMES_BY_TAG,
    parseStyleAttributes: false,
  }),
});

export default sanitizeHtml;
