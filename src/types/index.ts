// src/types/index.ts
export type MusicGenre =
  | "kpop"
  | "classical"
  | "anime-ost"
  | "jpop"
  | "cpop"
  | "pop"
  | "other";

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

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  spotifyUrl?: string;
  youtubeUrl?: string;
}

export interface PlaylistRecommendation {
  title: string;
  description: string;
  reason: string;
  songs: Song[];
  avgAudioFeatures: {
    energy: number;
    valence: number;
    danceability: number;
    tempo: number;
    acousticness: number;
    instrumentalness: number;
  };
}
