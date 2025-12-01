
export const getSambaNovaApiKey = (): string | null => {
  try {
    return localStorage.getItem("sambanova_api_key");
  } catch (error) {
    console.error("Error retrieving SambaNova API key:", error);
    return null;
  }
};

export const hasSambaNovaApiKey = (): boolean => {
  return getSambaNovaApiKey() !== null;
};
