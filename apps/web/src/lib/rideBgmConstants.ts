export const BG_MUSIC_NEAR_END_SEC = 0.38;
export const BG_MUSIC_WATCHDOG_MS = 480;
export const BG_MUSIC_ADVANCE_DEBOUNCE_MS = 420;
export const BG_MUSIC_ERROR_SUPPRESS_MS = 400;
export const BG_MUSIC_FADE_IN_TARGET = 0.3;
export const BG_MUSIC_FADE_MS = 2000;

/** Dropbox 등 공유 URL. `VITE_RIDE_BGM_PLAYLIST_JSON`이 비어 있거나 파싱 실패 시 사용 */
export const RIDE_BGM_BUILTIN_PLAYLIST: readonly string[] = [
  "https://www.dropbox.com/scl/fi/0faz2sk5p3sa3faodppc9/___-Remastered.mp3?rlkey=t0tiqm3po5ktfpqodby8665hw&st=3i57ybqu&dl=1",
  "https://www.dropbox.com/scl/fi/41z8m3j4oamnay0h1ko2q/.mp3?rlkey=sa31hghtq0vg3tdxdkis5cvx4&st=tv5kecjg&dl=1",
  "https://www.dropbox.com/scl/fi/k976v42zddy340k2wu7fm/Remastered-1.mp3?rlkey=mxg7f8oyw62xyq16p4jw419yh&st=woegl8g9&dl=1",
  "https://www.dropbox.com/scl/fi/5oseee6wc35asvchg0m7f/Remastered.mp3?rlkey=c82cv94wq00jj8o5ohyr6zcik&st=cmk2189q&dl=1",
  "https://www.dropbox.com/scl/fi/xmstjc33yractfy18k7g1/Brushing-Teeth-in-the-Morning.mp3?rlkey=0ie50ur6z2hr1t3cekreokqbm&st=lmn7p261&dl=1",
  "https://www.dropbox.com/scl/fi/tc0qkixfvj4rq2ulwtcw4/Fast-Recorder-Play.mp3?rlkey=7xp82nfkd0df16cj4l7e6vc95&st=bkuxlebh&dl=1",
  "https://www.dropbox.com/scl/fi/essqj2xo5fflpqg8vky2d/Hyperdrive-Circuit.mp3?rlkey=14v0r13v9z6uvcjo0vcjmpmk5&st=nnq8e6fh&dl=1",
  "https://www.dropbox.com/scl/fi/if7c1yzc9uviz415sz7jw/Let-s-Go-on-a-Trip-1.mp3?rlkey=uduy9c77kdgllj4o6jh9azh2v&st=4opmjfqc&dl=1",
  "https://www.dropbox.com/scl/fi/tpoiae5vy3pdoeagjq6b9/Let-s-Have-a-Blast.mp3?rlkey=wi50njh9e7w7x46zkh53ksr72&st=7zhyvib0&dl=1",
  "https://www.dropbox.com/scl/fi/1law34bbpncjpfqxtzisd/Magyar-T-zek.mp3?rlkey=s1rpoxyr3pb9dq2t8euxtg117&st=n0lbq087&dl=1",
  "https://www.dropbox.com/scl/fi/dm60xi68ybtorg2h5sykh/Speed-Circuit.mp3?rlkey=2pw90ceqj5tz9mapi89cxrl32&st=b7jqmkeb&dl=1",
  "https://www.dropbox.com/scl/fi/d23ffdceriocdvez7olye/Starlight-Circuit.mp3?rlkey=o4h1c1n42x9n0ryz1k9no4acr&st=lod15q5b&dl=1",
  "https://www.dropbox.com/scl/fi/v7rjtkj4slu6brt01780p/Top-Speed.mp3?rlkey=51qi29dl8nq1z0f7rs57e4yto&st=ormm9kyh&dl=1",
  "https://www.dropbox.com/scl/fi/ubpo1uf2qqcfa1y0sam8s/Traveling-Is-Fun-1.mp3?rlkey=c81h5upejn30itjp27trayutf&st=ucsbn0ux&dl=1",
  "https://www.dropbox.com/scl/fi/neqzwt2hw4eaubt23ecye/Traveling-Is-Fun.mp3?rlkey=ftv50scvsjgrxfutqg3l0fel9&st=u4iecrmb&dl=1",
  "https://www.dropbox.com/scl/fi/2maxm34hi9rivbq2w40ee/Tuna-Run.mp3?rlkey=emhzumrrheaqhl525msc3na8f&st=sz1umr9f&dl=1",
];

function parsePlaylistFromEnv(): string[] {
  const raw = import.meta.env.VITE_RIDE_BGM_PLAYLIST_JSON?.trim();
  if (!raw) return [...RIDE_BGM_BUILTIN_PLAYLIST];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [...RIDE_BGM_BUILTIN_PLAYLIST];
    const urls = arr.filter((u): u is string => typeof u === "string" && u.length > 0);
    return urls.length > 0 ? urls : [...RIDE_BGM_BUILTIN_PLAYLIST];
  } catch {
    return [...RIDE_BGM_BUILTIN_PLAYLIST];
  }
}

export const RIDE_BGM_PLAYLIST: readonly string[] = parsePlaylistFromEnv();
