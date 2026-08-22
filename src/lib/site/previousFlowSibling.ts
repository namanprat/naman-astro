/**
 * Previous sibling in document flow, walking up past Astro island hosts
 * (and similar wrappers) when the element is their only child.
 */
export function previousFlowSibling(el: Element | null): Element | null {
  let node: Element | null = el;
  while (node && node !== document.body) {
    if (node.previousElementSibling) return node.previousElementSibling;
    node = node.parentElement;
  }
  return null;
}
