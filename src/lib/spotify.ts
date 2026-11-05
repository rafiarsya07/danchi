/** Turn whatever they paste (link or URI) into a Spotify URI we can embed. */
export function spotifyUri(input: string): string | null {
  const s = input.trim();
  const uri = s.match(/^spotify:(playlist|album|track|artist):([A-Za-z0-9]{10,40})$/);
  if (uri) return `spotify:${uri[1]}:${uri[2]}`;
  const url = s.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(playlist|album|track|artist)\/([A-Za-z0-9]{10,40})/i);
  if (url) return `spotify:${url[1].toLowerCase()}:${url[2]}`;
  return null;
}

export const isTrackUri = (u: string | null | undefined) => !!u && /^spotify:(track|episode):[A-Za-z0-9]{10,40}$/.test(u);
