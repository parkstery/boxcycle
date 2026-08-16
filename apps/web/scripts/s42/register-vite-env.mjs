import { register } from "node:module";

register(new URL("./vite-env-loader.mjs", import.meta.url), import.meta.url);
