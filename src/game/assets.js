// Shared asset resolver for the Vite development server, GitHub Pages and the
// self-contained file:// build. The standalone exporter injects the embedded
// payload before the game bundle; normal hosted builds keep using lazy files.
function embeddedPayload() {
  return globalThis.__GEAR_LANDS_EMBEDDED__;
}

export function assetUrl(path) {
  const clean = String(path).replace(/^\.?\//, '');
  return embeddedPayload()?.assets?.[clean] || `./${clean}`;
}

export async function readAudioManifest() {
  const embedded = embeddedPayload()?.manifest;
  if (embedded) return embedded;
  const response = await fetch(assetUrl('audio/manifest.json'));
  if (!response.ok) throw new Error(`Audio manifest: HTTP ${response.status}`);
  return response.json();
}

// Only called after the user's start/sound gesture. Decoding one track at a time
// keeps the offline build's memory use close to the streamed hosted version.
export function embeddedAudioBytes(file) {
  const encoded = embeddedPayload()?.audio?.[file];
  if (!encoded) return null;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
