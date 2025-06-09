export interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  genre?: MusicGenre;
  llmProvider?: "gemini" | "openai" | "other";
  analysis?: {
    extractedContext: any;
    confidence: number;
  };
}
