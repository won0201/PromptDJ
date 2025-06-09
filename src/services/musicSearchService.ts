// src/services/musicSearchService.ts
import type { MusicGenre } from "@/types";

// YouTube Data API 타입 정의
interface YouTubeVideo {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeVideo[];
  pageInfo: {
    totalResults: number;
  };
}

// Spotify Web API 타입 정의
interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    name: string;
    id: string;
  }>;
  album: {
    name: string;
    images: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

interface SpotifyAudioFeatures {
  energy: number;
  valence: number;
  danceability: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  speechiness: number;
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
  };
}

// 통합 음악 정보 타입
export interface MusicSearchResult {
  // 기본 정보
  title: string;
  artist: string;
  album?: string;

  // YouTube 정보
  youtubeVideoId: string;
  youtubeUrl: string;
  youtubeThumbnail: string;

  // Spotify 정보 (있는 경우)
  spotifyId?: string;
  spotifyUrl?: string;
  spotifyPreviewUrl?: string;

  // Audio Features (Spotify에서)
  audioFeatures?: SpotifyAudioFeatures;

  // 메타데이터
  duration?: number;
  popularity?: number;
  publishedAt?: string;

  // 검색 컨텍스트
  searchContext: string;
  confidence: number;
}

export class MusicSearchService {
  private youtubeApiKey: string;
  private spotifyClientId: string;
  private spotifyClientSecret: string;
  private spotifyAccessToken: string | null = null;

  constructor() {
    // 🔑 환경변수 디버깅 로그 추가
    console.log("🔑 환경변수 확인:");
    console.log(
      "YOUTUBE_API_KEY:",
      process.env.YOUTUBE_API_KEY ? "✅ 있음" : "❌ 없음"
    );
    console.log(
      "SPOTIFY_CLIENT_ID:",
      process.env.SPOTIFY_CLIENT_ID ? "✅ 있음" : "❌ 없음"
    );
    console.log(
      "SPOTIFY_CLIENT_SECRET:",
      process.env.SPOTIFY_CLIENT_SECRET ? "✅ 있음" : "❌ 없음"
    );

    // 실제 값도 일부 확인 (보안상 일부만)
    if (process.env.YOUTUBE_API_KEY) {
      console.log(
        "YOUTUBE_API_KEY 앞 10글자:",
        process.env.YOUTUBE_API_KEY.substring(0, 10) + "..."
      );
    }
    if (process.env.SPOTIFY_CLIENT_ID) {
      console.log(
        "SPOTIFY_CLIENT_ID 앞 10글자:",
        process.env.SPOTIFY_CLIENT_ID.substring(0, 10) + "..."
      );
    }

    this.youtubeApiKey = process.env.YOUTUBE_API_KEY || "";
    this.spotifyClientId = process.env.SPOTIFY_CLIENT_ID || "";
    this.spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";

    if (
      !this.youtubeApiKey ||
      !this.spotifyClientId ||
      !this.spotifyClientSecret
    ) {
      throw new Error("YouTube 또는 Spotify API 키가 설정되지 않았습니다");
    }
  }

  // Spotify 액세스 토큰 획득
  private async getSpotifyAccessToken(): Promise<string> {
    if (this.spotifyAccessToken) {
      return this.spotifyAccessToken;
    }

    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${this.spotifyClientId}:${this.spotifyClientSecret}`
          ).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      });

      const data = await response.json();
      this.spotifyAccessToken = data.access_token;

      // 토큰 만료 전에 갱신하도록 스케줄링 (55분 후)
      setTimeout(() => {
        this.spotifyAccessToken = null;
      }, 55 * 60 * 1000);

      return this.spotifyAccessToken;
    } catch (error) {
      console.error("Spotify 토큰 획득 실패:", error);
      throw new Error("Spotify 인증 실패");
    }
  }

  // YouTube에서 음악 검색
  async searchYouTubeMusic(
    query: string,
    maxResults: number = 5
  ): Promise<YouTubeVideo[]> {
    try {
      const searchQuery = encodeURIComponent(`${query} official audio music`);
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
          `part=snippet&type=video&videoCategoryId=10&` +
          `q=${searchQuery}&maxResults=${maxResults}&key=${this.youtubeApiKey}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API 오류: ${response.status}`);
      }

      const data: YouTubeSearchResponse = await response.json();
      return data.items || [];
    } catch (error) {
      console.error("YouTube 검색 실패:", error);
      return [];
    }
  }

  // Spotify에서 음악 검색
  async searchSpotifyMusic(
    query: string,
    limit: number = 5
  ): Promise<SpotifyTrack[]> {
    try {
      const accessToken = await this.getSpotifyAccessToken();
      const searchQuery = encodeURIComponent(query);

      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Spotify API 오류: ${response.status}`);
      }

      const data: SpotifySearchResponse = await response.json();
      return data.tracks.items || [];
    } catch (error) {
      console.error("Spotify 검색 실패:", error);
      return [];
    }
  }

  // Spotify Audio Features 가져오기
  async getSpotifyAudioFeatures(
    trackId: string
  ): Promise<SpotifyAudioFeatures | null> {
    try {
      const accessToken = await this.getSpotifyAccessToken();

      const response = await fetch(
        `https://api.spotify.com/v1/audio-features/${trackId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Spotify Audio Features 가져오기 실패:", error);
      return null;
    }
  }

  // 통합 음악 검색 (핵심 기능!)
  async searchMusic(
    query: string,
    context: string
  ): Promise<MusicSearchResult | null> {
    try {
      console.log(`🔍 음악 검색 시작: "${query}" (맥락: ${context})`);

      // 동시에 YouTube와 Spotify 검색
      const [youtubeResults, spotifyResults] = await Promise.all([
        this.searchYouTubeMusic(query, 3),
        this.searchSpotifyMusic(query, 3),
      ]);

      if (youtubeResults.length === 0) {
        console.log("❌ YouTube 검색 결과 없음");
        return null;
      }

      // 최적의 YouTube 비디오 선택 (공식 채널, 조회수 등 고려)
      const bestYouTubeVideo = this.selectBestYouTubeVideo(youtubeResults);

      // Spotify에서 매칭되는 트랙 찾기
      const matchingSpotifyTrack = this.findMatchingSpotifyTrack(
        bestYouTubeVideo,
        spotifyResults
      );

      // Audio Features 가져오기 (Spotify 트랙이 있는 경우)
      let audioFeatures: SpotifyAudioFeatures | null = null;
      if (matchingSpotifyTrack) {
        audioFeatures = await this.getSpotifyAudioFeatures(
          matchingSpotifyTrack.id
        );
      }

      // 결과 통합
      const result: MusicSearchResult = {
        title: this.cleanTrackTitle(bestYouTubeVideo.snippet.title),
        artist: this.extractArtistName(
          bestYouTubeVideo.snippet.title,
          bestYouTubeVideo.snippet.channelTitle
        ),
        album: matchingSpotifyTrack?.album.name,

        youtubeVideoId: bestYouTubeVideo.id.videoId,
        youtubeUrl: `https://youtu.be/${bestYouTubeVideo.id.videoId}`,
        youtubeThumbnail: bestYouTubeVideo.snippet.thumbnails.medium.url,

        spotifyId: matchingSpotifyTrack?.id,
        spotifyUrl: matchingSpotifyTrack?.external_urls.spotify,
        spotifyPreviewUrl: matchingSpotifyTrack?.preview_url,

        audioFeatures: audioFeatures || undefined,

        duration: matchingSpotifyTrack?.duration_ms,
        popularity: matchingSpotifyTrack?.popularity,
        publishedAt: bestYouTubeVideo.snippet.publishedAt,

        searchContext: context,
        confidence: this.calculateConfidence(
          bestYouTubeVideo,
          matchingSpotifyTrack,
          audioFeatures
        ),
      };

      console.log("✅ 음악 검색 완료:", result.artist, "-", result.title);
      return result;
    } catch (error) {
      console.error("🚨 음악 검색 중 오류:", error);
      return null;
    }
  }

  // 최적의 YouTube 비디오 선택
  private selectBestYouTubeVideo(videos: YouTubeVideo[]): YouTubeVideo {
    // 우선순위: 공식 채널 > 제목에 "Official" 포함 > 첫 번째 결과
    return (
      videos.find(
        (video) =>
          video.snippet.channelTitle.toLowerCase().includes("official") ||
          video.snippet.title.toLowerCase().includes("official")
      ) || videos[0]
    );
  }

  // Spotify 트랙 매칭
  private findMatchingSpotifyTrack(
    youtubeVideo: YouTubeVideo,
    spotifyTracks: SpotifyTrack[]
  ): SpotifyTrack | null {
    const youtubeTitle = youtubeVideo.snippet.title.toLowerCase();

    return (
      spotifyTracks.find((track) => {
        const trackTitle = track.name.toLowerCase();
        const artistName = track.artists[0].name.toLowerCase();

        return (
          youtubeTitle.includes(trackTitle) || youtubeTitle.includes(artistName)
        );
      }) ||
      spotifyTracks[0] ||
      null
    );
  }

  // 트랙 제목 정리
  private cleanTrackTitle(title: string): string {
    return title
      .replace(/\[.*?\]/g, "") // [Official Video] 등 제거
      .replace(/\(.*?\)/g, "") // (Official Audio) 등 제거
      .replace(/official|audio|video|mv|music/gi, "") // 키워드 제거
      .replace(/\s+/g, " ") // 여러 공백을 하나로
      .trim();
  }

  // 아티스트명 추출
  private extractArtistName(title: string, channelTitle: string): string {
    // 제목에서 아티스트명 추출 시도
    const titleParts = title.split("-");
    if (titleParts.length >= 2) {
      return titleParts[0].trim();
    }

    // 채널명에서 추출
    return channelTitle.replace(/official|vevo|entertainment/gi, "").trim();
  }

  // 신뢰도 계산
  private calculateConfidence(
    youtubeVideo: YouTubeVideo,
    spotifyTrack: SpotifyTrack | null,
    audioFeatures: SpotifyAudioFeatures | null
  ): number {
    let confidence = 0.5;

    // YouTube 공식 채널인 경우
    if (youtubeVideo.snippet.channelTitle.toLowerCase().includes("official")) {
      confidence += 0.2;
    }

    // Spotify 매칭이 있는 경우
    if (spotifyTrack) {
      confidence += 0.2;
    }

    // Audio Features가 있는 경우
    if (audioFeatures) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  // 컨텍스트별 검색 쿼리 최적화
  generateOptimizedQuery(
    originalQuery: string,
    context: string,
    genre: MusicGenre
  ): string {
    const contextKeywords = {
      study: "chill relax focus",
      workout: "energetic upbeat powerful",
      sad: "ballad emotional slow",
      happy: "upbeat cheerful positive",
      party: "dance party club",
      chill: "chill mellow relaxing",
    };

    const genreKeywords = {
      kpop: "kpop korean",
      jpop: "jpop japanese",
      pop: "pop",
      classical: "classical",
      "anime-ost": "anime ost soundtrack",
      other: "",
    };

    const contextKeyword = contextKeywords[context] || "";
    const genreKeyword = genreKeywords[genre] || "";

    return `${originalQuery} ${genreKeyword} ${contextKeyword}`.trim();
  }
}

// 싱글톤 인스턴스
let musicSearchServiceInstance: MusicSearchService | null = null;

export function getMusicSearchService(): MusicSearchService {
  if (!musicSearchServiceInstance) {
    musicSearchServiceInstance = new MusicSearchService();
  }
  return musicSearchServiceInstance;
}
