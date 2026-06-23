export function playgroundAssetUrl(path) {
  return new URL(path, import.meta.url).toString();
}
