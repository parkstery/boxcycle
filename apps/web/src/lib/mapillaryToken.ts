const raw = import.meta.env.VITE_MAPILLARY_CLIENT_TOKEN?.trim() ?? "";

export const MAPILLARY_CLIENT_TOKEN = raw;

export const mapillaryTokenConfigured = raw.length > 0;
