import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

let container: AstroContainer | undefined;

/** Renders an Astro component to an HTML string (no browser needed). */
export async function render(
  component: AstroComponentFactory,
  props: Record<string, unknown> = {},
  slot?: string,
): Promise<string> {
  container ??= await AstroContainer.create();
  return container.renderToString(component, {
    props,
    slots: slot === undefined ? {} : { default: slot },
  });
}

/** Opening tag of the first element matching `selector` (tag name, optionally with a class). */
export function tag(html: string, name: string, className?: string): string {
  const pattern = className
    ? new RegExp(`<${name}\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`)
    : new RegExp(`<${name}\\b[^>]*>`);
  const match = pattern.exec(html);
  if (!match)
    throw new Error(`<${name}${className ? `.${className}` : ''}> not found in:\n${html}`);
  return match[0];
}

/** Value of `attribute` in an opening tag, or null. */
export function attr(openingTag: string, attribute: string): string | null {
  const match = new RegExp(`\\s${attribute}="([^"]*)"`).exec(openingTag);
  return match ? (match[1] ?? '') : null;
}
