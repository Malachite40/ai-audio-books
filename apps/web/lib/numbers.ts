export function millify(
  number: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    ...options,
  }).format(number);
}
