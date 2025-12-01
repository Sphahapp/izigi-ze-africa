export type ModelCapabilities = {
  text: boolean;
  code: boolean;
  image: boolean;
  video: boolean;
  threeD: boolean;
};

export type SambaNovaModel = {
  id: string;
  displayName: string;
  provider: "sambanova";
  capabilities: ModelCapabilities;
  contextWindow: number;
  maxOutputTokens: number;
};


