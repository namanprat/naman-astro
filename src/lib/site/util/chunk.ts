/** Split a list into columns of `size` before spilling to the next. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const columns: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    columns.push([...items.slice(i, i + size)]);
  }
  return columns;
}
