export const normalizeUrls = (urls?: string[] | null) =>
  (urls ?? []).map((url) => url.trim()).filter(Boolean);

export const urlsToTextareaValue = (urls?: string[] | null) =>
  normalizeUrls(urls).join("\n");

export const textareaValueToUrls = (value: string) =>
  value
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
