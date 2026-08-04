/**
 * Legacy template-block handling.
 *
 * Section templates (tick a checkbox tree, get a generated paragraph) have been
 * retired in favour of section ACTIONS — see section-actions.ts for why. What
 * survives here is the reading half: notes written while templates existed
 * still hold their generated prose wrapped in these delimiters, and those notes
 * are signed legal records that must keep rendering, printing and transmitting
 * exactly as they always did.
 *
 * So nothing writes a template block any more, but everything that displays a
 * note still strips the markers on the way out.
 */

export const TEMPLATE_BLOCK_START = '<!--template-->';
export const TEMPLATE_BLOCK_END = '<!--/template-->';

/**
 * Ticks behind a retired section template. Still carried on stored notes so an
 * old note's captured state is never silently dropped when it is loaded and
 * re-saved.
 */
export type TemplateSelection = Record<string, boolean | string>;

/** Strip the delimiters for display, print and transmission. */
export function stripTemplateMarkers(text: string): string {
  return (text || '')
    .split(TEMPLATE_BLOCK_START).join('')
    .split(TEMPLATE_BLOCK_END).join('');
}
