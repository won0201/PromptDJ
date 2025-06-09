// src/services/geminiService.ts
import type { MusicGenre, PlaylistRecommendation, Song } from "@/types";
import {
  getMusicSearchService,
  type MusicSearchResult,
} from "./musicSearchService";

interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        functionCall?: {
          name: string;
          args: any;
        };
      }>;
    };
    finishReason?: string;
  }>;
}

// 🆕 플레이리스트 관련 타입 정의
interface PlaylistInfo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
}

interface PlaylistSong {
  videoId: string;
  title: string;
  artist: string;
  originalTitle: string;
}

export class GeminiService {
  private apiKey: string;
  private baseUrl =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
  }

  // 🆕 플레이리스트 기반 추천 (새로운 핵심 기능)
  async getPlaylistBasedRecommendation(
    prompt: string,
    genre: MusicGenre,
    context?: {
      previousMessages?: string[];
      playlistContext?: string[];
      reviewContext?: string[];
      tagContext?: string[];
      similarSongs?: string[];
      excludedSongs?: string[]; // 🆕 중복 방지
    }
  ): Promise<{
    recommendation: string;
    searchResult?: MusicSearchResult;
    playlistSource?: string;
  }> {
    try {
      console.log("🎵 플레이리스트 기반 추천 시작...");
      console.log("🚫 제외할 곡:", context?.excludedSongs?.length || 0, "개");

      // 1단계: 사용자 요청 분석하여 플레이리스트 검색
      const playlistQuery = this.generatePlaylistSearchQuery(prompt, genre);
      console.log("🔍 플레이리스트 검색어:", playlistQuery);

      // 2단계: 실제 플레이리스트 검색
      const playlists = await this.searchRelevantPlaylists(
        playlistQuery,
        genre
      );

      if (playlists.length === 0) {
        console.log("❌ 관련 플레이리스트 없음, 기본 추천 사용");
        return await this.getMusicRecommendationWithRealTimeSearch(
          prompt,
          genre,
          context
        );
      }

      // 3단계: 여러 플레이리스트에서 곡 추출 시도
      for (const playlist of playlists.slice(0, 3)) {
        // 상위 3개 플레이리스트 시도
        console.log("📂 플레이리스트 확인:", playlist.title);

        const playlistSongs = await this.extractSongsFromPlaylist(playlist.id);

        if (playlistSongs.length === 0) {
          console.log(
            "❌ 플레이리스트에서 곡 추출 실패, 다음 플레이리스트 시도"
          );
          continue;
        }

        // 4단계: 중복 제거 필터링
        const availableSongs = this.filterExcludedSongs(
          playlistSongs,
          context?.excludedSongs || []
        );

        if (availableSongs.length === 0) {
          console.log("❌ 새로운 곡 없음, 다음 플레이리스트 시도");
          continue; // 🆕 다음 플레이리스트에서 새로운 곡 찾기
        }

        // 5단계: 곡 선택 및 검색
        const selectedSong = this.selectBestSongFromPlaylist(
          availableSongs,
          prompt
        );
        console.log(
          "🎯 선택된 곡:",
          selectedSong.title,
          "by",
          selectedSong.artist
        );

        // 6단계: 선택된 곡의 YouTube MV 직접 검색 (장르 정보 전달)
        const mvSearchQuery = `${selectedSong.artist} ${selectedSong.title} official mv`;
        console.log("🎬 MV 검색:", mvSearchQuery);

        const mvResult = await this.searchYoutubeMV(mvSearchQuery, genre); // 🆕 장르 정보 전달

        if (mvResult) {
          // 🆕 중복 체크 - 새로운 곡 찾을 때까지 계속 시도
          const resultSongKey = `${mvResult.artist}-${mvResult.title}`;
          if (context?.excludedSongs?.includes(resultSongKey)) {
            console.log(
              "🔄 이미 추천한 곡, 다음 플레이리스트에서 새로운 곡 찾는 중..."
            );
            continue; // 🆕 다음 플레이리스트에서 새로운 곡 시도
          }

          const recommendation = this.formatMVBasedRecommendation(
            mvResult,
            playlist.title,
            prompt
          );

          console.log("✅ 플레이리스트 기반 MV 추천 성공!");
          return {
            recommendation,
            searchResult: mvResult,
            playlistSource: playlist.title,
          };
        }
      }

      // 모든 플레이리스트에서 실패한 경우 기본 추천으로 폴백
      console.log(
        "⚠️ 모든 플레이리스트 시도 완료, 기본 추천으로 새로운 곡 찾기"
      );
      return await this.getMusicRecommendationWithRealTimeSearch(
        prompt,
        genre,
        context
      );
    } catch (error) {
      console.error("🚨 플레이리스트 기반 추천 오류:", error);
      // 에러 시 기본 추천으로 폴백
      return await this.getMusicRecommendationWithRealTimeSearch(
        prompt,
        genre,
        context
      );
    }
  }

  // 플레이리스트 검색 쿼리 생성
  private generatePlaylistSearchQuery(
    prompt: string,
    genre: MusicGenre
  ): string {
    const emotionKeywords = {
      슬프: "sad melancholy emotional ballad crying",
      우울: "sad depression comfort healing lonely",
      행복: "happy cheerful upbeat positive joyful",
      신나: "energetic excited party dance upbeat",
      공부: "study focus concentration", // 🚨 chill, calm 제거 (lofi 유도 방지)
      운동: "workout gym motivation energetic powerful",
      잠: "sleep relaxing calm lullaby peaceful",
      사랑: "love romantic sweet heart tender",
      그리: "nostalgic missing longing memories",
      위로: "comfort healing consolation support",
      스트레스: "stress relief relaxation calm",
      힐링: "healing peaceful meditation calm",
    };

    const genreKeywords = {
      kpop: "kpop korean k-pop 한국음악 korean music idol", // 🚨 더 구체적으로
      pop: "pop western english american music",
      classical: "classical piano instrumental orchestra",
      jpop: "jpop japanese j-pop 일본음악 japanese music",
      "anime-ost": "anime ost soundtrack opening ending",
      cpop: "cpop chinese mandarin c-pop taiwanese music",
      other: "music songs",
    };

    let searchTerms = [];

    // 🚨 장르를 가장 강력하게 우선 (2번 추가)
    const genreKeyword = genreKeywords[genre] || "music";
    searchTerms.push(genreKeyword);
    searchTerms.push(genreKeyword); // 중복 추가로 가중치 강화

    // 감정 키워드 매칭 (장르 다음에 배치)
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (prompt.includes(emotion)) {
        searchTerms.push(keywords);
        break;
      }
    }

    // 기본 플레이리스트 검색어 추가
    const query = searchTerms.join(" ") + " playlist";
    console.log(`🔍 생성된 검색어: "${query}"`);

    return query;
  }

  // 실제 플레이리스트 검색 (YouTube API 사용)
  private async searchRelevantPlaylists(
    query: string,
    genre: MusicGenre
  ): Promise<PlaylistInfo[]> {
    try {
      const youtubeApiKey = process.env.YOUTUBE_API_KEY;
      if (!youtubeApiKey) {
        throw new Error("YouTube API key not found");
      }

      const searchQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
          `part=snippet&type=playlist&q=${searchQuery}&maxResults=10&key=${youtubeApiKey}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();

      let playlists =
        data.items?.map((item: any) => ({
          id: item.id.playlistId,
          title: item.snippet.title,
          description: item.snippet.description || "",
          channelTitle: item.snippet.channelTitle,
        })) || [];

      // 장르별 필터링 적용
      playlists = this.filterPlaylistsByGenre(playlists, genre);
      console.log(
        `📂 필터링 후 플레이리스트 ${playlists.length}개:`,
        playlists.map((p) => p.title)
      );

      return playlists;
    } catch (error) {
      console.error("플레이리스트 검색 실패:", error);
      return [];
    }
  }

  // 🆕 장르별 플레이리스트 필터링 (완전히 새로 추가)
  private filterPlaylistsByGenre(
    playlists: PlaylistInfo[],
    genre: MusicGenre
  ): PlaylistInfo[] {
    const genreFilters = {
      kpop: (title: string, desc: string) => {
        const text = (title + " " + desc).toLowerCase();
        // 🚨 K-Pop 강화 필터링 - 더 엄격하게!
        const hasKpopKeyword =
          text.includes("kpop") ||
          text.includes("k-pop") ||
          text.includes("korean") ||
          text.includes("한국") ||
          text.includes("케이팝") ||
          text.includes("bts") ||
          text.includes("blackpink") ||
          text.includes("twice") ||
          text.includes("stray kids") ||
          text.includes("itzy") ||
          text.includes("red velvet") ||
          text.includes("aespa");

        // 다른 장르는 강력하게 제외
        const hasOtherGenre =
          text.includes("lofi") ||
          text.includes("lo-fi") ||
          text.includes("jazz") ||
          text.includes("hip hop") ||
          text.includes("electronic") ||
          text.includes("classical") ||
          text.includes("chill beats") ||
          text.includes("study music") ||
          text.includes("background music") ||
          text.includes("instrumental") ||
          text.includes("piano") ||
          text.includes("guitar");

        return hasKpopKeyword && !hasOtherGenre;
      },

      pop: (title: string, desc: string) => {
        const text = (title + " " + desc).toLowerCase();
        const hasPopKeyword =
          text.includes("pop") ||
          text.includes("western") ||
          text.includes("english") ||
          text.includes("american") ||
          text.includes("british");

        const hasOtherGenre =
          text.includes("kpop") ||
          text.includes("k-pop") ||
          text.includes("jpop") ||
          text.includes("lofi") ||
          text.includes("classical") ||
          text.includes("jazz");

        return hasPopKeyword && !hasOtherGenre;
      },

      classical: (title: string, desc: string) => {
        const text = (title + " " + desc).toLowerCase();
        return (
          text.includes("classical") ||
          text.includes("piano") ||
          text.includes("orchestra") ||
          text.includes("symphony") ||
          text.includes("mozart") ||
          text.includes("beethoven") ||
          text.includes("chopin") ||
          text.includes("bach")
        );
      },

      jpop: (title: string, desc: string) => {
        const text = (title + " " + desc).toLowerCase();
        const hasJpopKeyword =
          text.includes("jpop") ||
          text.includes("j-pop") ||
          text.includes("japanese") ||
          text.includes("일본") ||
          text.includes("제이팝");

        const hasOtherGenre =
          text.includes("kpop") ||
          text.includes("k-pop") ||
          text.includes("lofi") ||
          text.includes("anime");

        return hasJpopKeyword && !hasOtherGenre;
      },

      "anime-ost": (title: string, desc: string) => {
        const text = (title + " " + desc).toLowerCase();
        return (
          text.includes("anime") ||
          text.includes("ost") ||
          text.includes("soundtrack") ||
          text.includes("opening") ||
          text.includes("ending") ||
          text.includes("naruto") ||
          text.includes("one piece") ||
          text.includes("attack on titan")
        );
      },

      cpop: (title: string, desc: string) => {
        const text = (title + " " + desc).toLowerCase();
        return (
          text.includes("cpop") ||
          text.includes("c-pop") ||
          text.includes("chinese") ||
          text.includes("mandarin") ||
          text.includes("taiwanese")
        );
      },

      other: () => true, // 기타는 모든 플레이리스트 허용
    };

    const filter = genreFilters[genre] || genreFilters.other;

    const filtered = playlists.filter((playlist) =>
      filter(playlist.title, playlist.description)
    );

    console.log(
      `🎯 ${genre} 장르 필터링: ${filtered.length}/${playlists.length}개 플레이리스트`
    );

    // 필터링 결과가 없으면 경고하고 빈 배열 반환 (다른 장르 섞이지 않도록)
    if (filtered.length === 0) {
      console.log(`⚠️ ${genre} 장르 플레이리스트를 찾을 수 없음`);
      return [];
    }

    return filtered;
  }

  // 플레이리스트에서 곡 추출
  private async extractSongsFromPlaylist(
    playlistId: string
  ): Promise<PlaylistSong[]> {
    try {
      const youtubeApiKey = process.env.YOUTUBE_API_KEY;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?` +
          `part=snippet&playlistId=${playlistId}&maxResults=50&key=${youtubeApiKey}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();

      const songs =
        data.items
          ?.map((item: any) => {
            const title = item.snippet.title;
            const channelTitle =
              item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle;

            return {
              videoId: item.snippet.resourceId?.videoId,
              title: this.extractSongTitle(title),
              artist: this.extractArtistName(title, channelTitle),
              originalTitle: title,
            };
          })
          .filter(
            (song: any) =>
              song.videoId &&
              song.title &&
              song.artist &&
              song.title.length > 2 && // 너무 짧은 제목 제외
              song.artist.length > 0 &&
              !song.title.toLowerCase().includes("deleted") &&
              !song.title.toLowerCase().includes("private") &&
              !song.title.toLowerCase().includes("mix") && // 🆕 믹스 제외
              !song.title.toLowerCase().includes("playlist") && // 🆕 플레이리스트 제외
              !song.originalTitle.toLowerCase().includes("compilation") && // 🆕 컴필레이션 제외
              // 🆕 오피셜 비디오/음원 우선 필터링
              this.isOfficialMusicVideo(song.originalTitle)
          ) || [];

      // 🆕 곡들을 무작위로 섞어서 다양성 확보
      const shuffled = songs.sort(() => Math.random() - 0.5);

      console.log(`🎵 플레이리스트에서 ${shuffled.length}개 곡 추출`);
      return shuffled;
    } catch (error) {
      console.error("플레이리스트 곡 추출 실패:", error);
      return [];
    }
  }

  // 🆕 오피셜 뮤직비디오/음원인지 확인
  private isOfficialMusicVideo(title: string): boolean {
    const titleLower = title.toLowerCase();

    // 🚨 먼저 플레이리스트/믹스 영상 제외 (가장 중요!)
    const playlistKeywords = [
      "mix",
      "playlist",
      "compilation",
      "collection",
      "hour",
      "hours",
      "minute",
      "minutes",
      "continuous",
      "non-stop",
      "nonstop",
      "best of",
      "greatest hits",
      "lofi",
      "lo-fi",
      "chill beats",
      "study music",
      "background music",
      "relaxing music",
      "meditation",
      "sleep music",
      "focus music",
      "work music",
    ];

    const isPlaylistVideo = playlistKeywords.some((keyword) =>
      titleLower.includes(keyword)
    );

    if (isPlaylistVideo) {
      return false; // 플레이리스트 영상은 무조건 제외
    }

    // 🚨 MV 우선 필터링 - MV만 찾기!
    const mvKeywords = [
      "mv",
      "music video",
      "official video",
      "official music video",
      "official mv",
      "official",
      "official audio",
    ];

    const isMV = mvKeywords.some((keyword) => titleLower.includes(keyword));

    // 제외할 키워드들 (커버, 라이브, 리믹스 등)
    const excludeKeywords = [
      "cover",
      "live",
      "remix",
      "acoustic",
      "unplugged",
      "karaoke",
      "instrumental",
      "piano version",
      "guitar version",
      "reaction",
      "review",
      "tutorial",
      "lesson",
      "cover by",
      "performed by",
      "cover version",
      "remake",
      "dance practice",
      "behind the scenes",
      "making of",
      "teaser",
      "preview",
      "lyric video",
      "lyrics",
      "audio only",
    ];

    const hasExcludeKeyword = excludeKeywords.some((keyword) =>
      titleLower.includes(keyword)
    );

    // MV 키워드가 있고 제외 키워드가 없어야 함
    return isMV && !hasExcludeKeyword;
  }

  // 🆕 YouTube MV 직접 검색 (조회수 필터링 추가)
  private async searchYoutubeMV(
    query: string,
    genre: MusicGenre
  ): Promise<MusicSearchResult | null> {
    try {
      const youtubeApiKey = process.env.YOUTUBE_API_KEY;
      if (!youtubeApiKey) {
        throw new Error("YouTube API key not found");
      }

      const searchQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
          `part=snippet&type=video&q=${searchQuery}&maxResults=20&key=${youtubeApiKey}` +
          `&order=relevance&videoDuration=medium` // 🆕 중간 길이 동영상 우선
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();

      // MV만 필터링
      const mvVideos =
        data.items?.filter((item: any) => {
          const title = item.snippet.title;
          return (
            this.isOfficialMusicVideo(title) &&
            this.matchesGenre(title, item.snippet.channelTitle, genre)
          );
        }) || [];

      if (mvVideos.length === 0) {
        console.log("❌ 장르에 맞는 MV를 찾을 수 없음");
        return null;
      }

      // 🆕 조회수 정보 가져오기
      const videoIds = mvVideos.map((video: any) => video.id.videoId).join(",");
      const statsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?` +
          `part=statistics&id=${videoIds}&key=${youtubeApiKey}`
      );

      if (!statsResponse.ok) {
        console.log("⚠️ 조회수 정보 가져오기 실패, 첫 번째 결과 사용");
        const mvVideo = mvVideos[0];

        // 🆕 검색 결과 링크로 변경
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          query
        )}`;

        return {
          title: this.extractSongTitle(mvVideo.snippet.title),
          artist: this.extractArtistName(
            mvVideo.snippet.title,
            mvVideo.snippet.channelTitle
          ),
          youtubeUrl: searchUrl, // 🆕 검색 결과 페이지 링크
          spotifyUrl: null,
          spotifyPreviewUrl: null,
          audioFeatures: null,
        };
      }

      const statsData = await statsResponse.json();

      // 🆕 장르별 최소 조회수 기준
      const minViewsByGenre = {
        kpop: 100000, // 10만회 (K-Pop 경쟁 치열)
        pop: 500000, // 50만회 (서구 팝은 더 높은 기준)
        classical: 10000, // 1만회 (클래식은 낮은 기준)
        jpop: 50000, // 5만회 (J-Pop 적당한 기준)
        "anime-ost": 100000, // 10만회 (애니 OST 인기도)
        cpop: 30000, // 3만회 (C-Pop 상대적으로 낮음)
        other: 50000, // 5만회 (기타 장르)
      };

      const minViews = minViewsByGenre[genre] || 50000;
      console.log(
        `🎯 ${genre} 장르 최소 조회수 기준: ${minViews.toLocaleString()}회`
      );

      // 조회수 필터링
      const popularVideos =
        statsData.items?.filter((videoStats: any) => {
          const viewCount = parseInt(videoStats.statistics.viewCount || "0");
          const isPopular = viewCount >= minViews;
          if (!isPopular) {
            console.log(
              `📊 조회수 부족: ${viewCount.toLocaleString()}회 (최소 ${minViews.toLocaleString()}회 필요)`
            );
          }
          return isPopular;
        }) || [];

      if (popularVideos.length === 0) {
        console.log("❌ 조회수 기준을 만족하는 MV 없음");
        return null;
      }

      // 가장 조회수가 높은 비디오 선택
      const topVideo = popularVideos.sort(
        (a: any, b: any) =>
          parseInt(b.statistics.viewCount) - parseInt(a.statistics.viewCount)
      )[0];

      const selectedMV = mvVideos.find(
        (video: any) => video.id.videoId === topVideo.id
      );

      if (!selectedMV) {
        console.log("❌ 선택된 MV를 찾을 수 없음");
        return null;
      }

      // 🆕 검색 결과 링크로 변경 (직접 영상 링크 대신)
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`;
      const viewCount = parseInt(topVideo.statistics.viewCount);

      console.log(`✅ 선택된 MV: 조회수 ${viewCount.toLocaleString()}회`);
      console.log(`🔍 검색 결과 링크 생성: ${searchUrl}`);

      return {
        title: this.extractSongTitle(selectedMV.snippet.title),
        artist: this.extractArtistName(
          selectedMV.snippet.title,
          selectedMV.snippet.channelTitle
        ),
        youtubeUrl: searchUrl, // 🆕 검색 결과 페이지 링크
        spotifyUrl: null,
        spotifyPreviewUrl: null,
        audioFeatures: null,
      };
    } catch (error) {
      console.error("YouTube MV 검색 실패:", error);
      return null;
    }
  }

  // 🆕 장르 매칭 확인
  private matchesGenre(
    title: string,
    channelTitle: string,
    genre: MusicGenre
  ): boolean {
    const text = (title + " " + channelTitle).toLowerCase();

    const genreMatchers = {
      kpop: () => {
        // K-Pop 아티스트 키워드
        const kpopKeywords = [
          "bts",
          "blackpink",
          "twice",
          "stray kids",
          "itzy",
          "aespa",
          "red velvet",
          "newjeans",
          "ive",
          "seventeen",
          "txt",
          "enhypen",
          "le sserafim",
          "nmixx",
          "gidle",
          "(g)i-dle",
          "iu",
          "taeyeon",
          "bigbang",
          "girls generation",
          "snsd",
          "exo",
          "nct",
          "shinee",
          "mamamoo",
          "oh my girl",
          "gfriend",
          "loona",
          "fromis_9",
          "korean",
          "kpop",
          "k-pop",
          "한국",
          "jyp",
          "sm",
          "yg",
          "hybe",
        ];

        const hasKpopKeyword = kpopKeywords.some((keyword) =>
          text.includes(keyword)
        );

        // 다른 장르 제외
        const hasOtherGenre =
          text.includes("lofi") ||
          text.includes("jazz") ||
          text.includes("classical") ||
          text.includes("anime") ||
          text.includes("japanese") ||
          text.includes("chinese");

        return hasKpopKeyword && !hasOtherGenre;
      },

      pop: () => {
        const popKeywords = [
          "taylor swift",
          "ed sheeran",
          "billie eilish",
          "dua lipa",
          "ariana grande",
          "olivia rodrigo",
          "harry styles",
          "the weeknd",
          "post malone",
          "justin bieber",
          "selena gomez",
          "bruno mars",
          "pop",
          "western",
          "english",
          "american",
          "british",
        ];

        const hasPopKeyword = popKeywords.some((keyword) =>
          text.includes(keyword)
        );
        const hasOtherGenre =
          text.includes("kpop") ||
          text.includes("k-pop") ||
          text.includes("jpop");

        return hasPopKeyword && !hasOtherGenre;
      },

      classical: () => {
        const classicalKeywords = [
          "classical",
          "piano",
          "orchestra",
          "symphony",
          "mozart",
          "beethoven",
          "chopin",
          "bach",
          "vivaldi",
          "tchaikovsky",
          "concerto",
          "sonata",
        ];
        return classicalKeywords.some((keyword) => text.includes(keyword));
      },

      jpop: () => {
        const jpopKeywords = [
          "jpop",
          "j-pop",
          "japanese",
          "yoasobi",
          "official hige dandism",
          "aimyon",
          "kenshi yonezu",
          "lisa",
          "one ok rock",
          "perfume",
          "일본",
          "japan",
          "tokyo",
        ];

        const hasJpopKeyword = jpopKeywords.some((keyword) =>
          text.includes(keyword)
        );
        const hasOtherGenre = text.includes("kpop") || text.includes("anime");

        return hasJpopKeyword && !hasOtherGenre;
      },

      "anime-ost": () => {
        const animeKeywords = [
          "anime",
          "ost",
          "soundtrack",
          "opening",
          "ending",
          "naruto",
          "one piece",
          "attack on titan",
          "demon slayer",
          "jujutsu kaisen",
          "your name",
          "spirited away",
          "ghibli",
        ];
        return animeKeywords.some((keyword) => text.includes(keyword));
      },

      cpop: () => {
        const cpopKeywords = [
          "cpop",
          "c-pop",
          "chinese",
          "mandarin",
          "taiwanese",
          "hong kong",
          "jay chou",
          "jj lin",
          "eason chan",
          "faye wong",
        ];
        return cpopKeywords.some((keyword) => text.includes(keyword));
      },

      other: () => true, // 기타는 모든 장르 허용
    };

    const matcher = genreMatchers[genre] || genreMatchers.other;
    const matches = matcher();

    if (!matches) {
      console.log(`🚫 장르 불일치 (${genre}): ${title}`);
    }

    return matches;
  }
  private filterExcludedSongs(
    songs: PlaylistSong[],
    excludedSongs: string[]
  ): PlaylistSong[] {
    const filtered = songs.filter((song) => {
      const songKey = `${song.artist}-${song.title}`;
      const isExcluded = excludedSongs.includes(songKey);
      if (isExcluded) {
        console.log("🚫 중복 제거:", songKey);
      }
      return !isExcluded;
    });

    console.log(
      `✂️ 중복 제거 후: ${filtered.length}/${songs.length}개 곡 남음`
    );
    return filtered;
  }

  // 플레이리스트에서 최적 곡 선택
  private selectBestSongFromPlaylist(
    songs: PlaylistSong[],
    prompt: string
  ): PlaylistSong {
    // 간단한 랜덤 선택 (나중에 더 정교한 매칭 로직 추가 가능)
    const randomIndex = Math.floor(Math.random() * songs.length);
    return songs[randomIndex];
  }

  // 곡 제목 정리 (기존 함수 개선)
  private extractSongTitle(fullTitle: string): string {
    const cleaned = fullTitle
      .replace(/\[.*?\]/g, "") // [Official Video] 등 제거
      .replace(/\(.*?\)/g, "") // (Official Audio) 등 제거
      .replace(
        /official|audio|video|mv|music|lyric|lyrics|full|album|ver\.|version/gi,
        ""
      ) // 더 많은 키워드 제거
      .replace(/\s+/g, " ")
      .trim();

    // '-'로 구분된 경우 처리 (다양한 대시 문자)
    const parts = cleaned.split(/[-–—]/); // 다양한 대시 문자 처리
    if (parts.length >= 2) {
      const potentialTitle = parts[1].trim();
      if (potentialTitle.length > 0) {
        return potentialTitle;
      }
    }

    return cleaned;
  }

  // 아티스트명 추출 (기존 함수 개선)
  private extractArtistName(title: string, channelTitle: string): string {
    // 제목에서 아티스트명 추출 시도
    const titleParts = title.split(/[-–—]/); // 다양한 대시 문자 처리
    if (titleParts.length >= 2) {
      const potentialArtist = titleParts[0].trim();
      if (potentialArtist.length > 0) {
        return potentialArtist;
      }
    }

    // 채널명에서 추출 (더 정교하게)
    const cleanChannelTitle = channelTitle
      .replace(/official|vevo|entertainment|music|records|channel|topic/gi, "") // 더 많은 키워드 제거
      .replace(/\s+/g, " ")
      .trim();

    return cleanChannelTitle || "Unknown Artist";
  }

  // 플레이리스트 기반 추천 메시지 포맷
  private formatPlaylistBasedRecommendation(
    searchResult: MusicSearchResult,
    playlistTitle: string,
    originalPrompt: string
  ): string {
    let message = `"${playlistTitle}" 플레이리스트에서 찾은 완벽한 곡이에요! 🎵\n\n`;
    message += `**🎵 추천곡: ${searchResult.artist} - ${searchResult.title}**\n\n`;

    // 플레이리스트 맥락 설명
    message += `이 곡은 "${playlistTitle}" 플레이리스트에 포함된 곡들 중에서 `;
    message += `"${originalPrompt}" 상황에 가장 잘 어울리는 한 곡을 선별해드린 거예요!\n\n`;

    // Audio Features 표시 (기존과 동일)
    if (searchResult.audioFeatures) {
      const features = searchResult.audioFeatures;
      message += `**🎼 음악적 특성:**\n`;
      message += `• 에너지: ${(features.energy * 100).toFixed(0)}% `;
      message += `• 긍정성: ${(features.valence * 100).toFixed(0)}% `;
      message += `• 댄스성: ${(features.danceability * 100).toFixed(0)}%\n`;
      message += `• 템포: ${Math.round(features.tempo)} BPM\n\n`;
    }

    // 링크 정보 (기존과 동일)
    message += `**🎧 플레이 링크:**\n`;
    // 🆕 YouTube 우선, 같은 곡 보장
    const youtubeUrl =
      searchResult.youtubeUrl ||
      `https://www.youtube.com/results?search_query=${encodeURIComponent(
        searchResult.artist + " " + searchResult.title + " official"
      )}`;

    message += `<!-- MUSIC_LINKS:${JSON.stringify({
      youtube: {
        url: youtubeUrl,
        label: "YouTube에서 듣기",
      },
      spotify: searchResult.spotifyUrl
        ? {
            url: searchResult.spotifyUrl,
            label: "Spotify에서 듣기",
          }
        : null,
      preview: searchResult.spotifyPreviewUrl
        ? {
            url: searchResult.spotifyPreviewUrl,
            label: "30초 미리듣기",
          }
        : null,
    })} -->\n`;

    return message;
  }

  // 기존 Function Calling 방식 (폴백용으로 유지)
  async getMusicRecommendationWithRealTimeSearch(
    prompt: string,
    genre: MusicGenre,
    context?: {
      previousMessages?: string[];
      playlistContext?: string[];
      reviewContext?: string[];
      tagContext?: string[];
      similarSongs?: string[];
      excludedSongs?: string[];
    }
  ): Promise<{ recommendation: string; searchResult?: MusicSearchResult }> {
    const systemPrompt = this.buildFunctionCallingSystemPrompt(
      genre,
      context?.excludedSongs
    );
    const userPrompt = this.buildContextualUserPrompt(prompt, context);

    try {
      console.log("🤖 Gemini Function Calling 시작...");
      console.log(
        "📤 전송할 프롬프트:",
        systemPrompt.substring(0, 100) + "..."
      );

      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt + "\n\n" + userPrompt }],
          },
        ],
        tools: [
          {
            function_declarations: [
              {
                name: "search_real_music",
                description: "실제 존재하는 음악을 검색합니다",
                parameters: {
                  type: "object",
                  properties: {
                    artist: {
                      type: "string",
                      description: "아티스트명",
                    },
                    song: {
                      type: "string",
                      description: "곡명",
                    },
                    context: {
                      type: "string",
                      description: "사용 맥락",
                      enum: [
                        "study",
                        "workout",
                        "chill",
                        "sad",
                        "happy",
                        "party",
                      ],
                    },
                    reason: {
                      type: "string",
                      description: "선택 이유",
                    },
                  },
                  required: ["artist", "song", "context", "reason"],
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
          maxOutputTokens: 512,
        },
      };

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Gemini API 오류:", response.status, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data: GeminiResponse = await response.json();

      // Function Call이 있는 경우
      if (data.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
        const functionCall = data.candidates[0].content.parts[0].functionCall;

        if (functionCall.name === "search_real_music") {
          const {
            artist,
            song,
            context: searchContext,
            reason,
          } = functionCall.args;

          // 🆕 중복 체크 - Function Calling 결과도 확인
          const songKey = `${artist}-${song}`;
          if (context?.excludedSongs?.includes(songKey)) {
            console.log("🔄 이미 추천한 곡, LLM에게 다른 곡 요청 중...");
            // 🆕 중복 시 재시도 - 새로운 곡 요청
            return await this.retryWithDifferentSong(prompt, genre, context);
          }

          console.log(
            `🔍 실제 음악 검색: ${artist} - ${song} (맥락: ${searchContext})`
          );

          // 실제 음악 검색 수행 - YouTube MV만 (장르 정보 전달)
          const mvSearchQuery = `${artist} ${song} official mv`;
          const mvResult = await this.searchYoutubeMV(mvSearchQuery, genre); // 🆕 장르 정보 전달

          if (mvResult) {
            // 🆕 검색 결과의 중복도 체크
            const resultSongKey = `${mvResult.artist}-${mvResult.title}`;
            if (context?.excludedSongs?.includes(resultSongKey)) {
              console.log(
                "🔄 검색 결과도 중복, 다른 곡으로 재시도:",
                resultSongKey
              );
              return await this.retryWithDifferentSong(prompt, genre, context);
            }

            const recommendation = this.formatMVRecommendationWithResult(
              mvResult,
              reason,
              searchContext
            );

            return {
              recommendation,
              searchResult: mvResult,
            };
          } else {
            return {
              recommendation: this.generateMVFallbackRecommendation(
                artist,
                song,
                reason,
                searchContext
              ),
            };
          }
        }
      }

      // 일반 텍스트 응답 (Function Call이 없는 경우)
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return {
          recommendation: data.candidates[0].content.parts[0].text,
        };
      }

      throw new Error("Gemini에서 유효한 응답을 받지 못했습니다");
    } catch (error) {
      console.error("🚨 Gemini Function Calling 오류:", error);

      // 폴백: 일반 추천
      const fallbackRecommendation =
        await this.getSimpleRealMusicRecommendation(prompt, genre, context);
      return {
        recommendation: fallbackRecommendation,
      };
    }
  }

  // Function Calling용 시스템 프롬프트 (아티스트 중복 방지)
  private buildFunctionCallingSystemPrompt(
    genre: MusicGenre,
    excludedSongs?: string[],
    retryAttempt?: number
  ): string {
    const genreExamples = {
      kpop: "BTS, BLACKPINK, TWICE, Stray Kids, IU, ITZY, aespa, NewJeans, IVE, Red Velvet, (G)I-DLE, SEVENTEEN, TXT, ENHYPEN 등",
      pop: "Taylor Swift, Ed Sheeran, Billie Eilish, Dua Lipa, Ariana Grande, The Weeknd 등",
      classical:
        "Mozart, Beethoven, Chopin, Bach, Vivaldi, Tchaikovsky 등의 클래식 작곡가",
      jpop: "YOASOBI, Official髭男dism, Aimyon, Kenshi Yonezu, ONE OK ROCK 등",
      "anime-ost":
        "Naruto, One Piece, Attack on Titan, Demon Slayer 등 애니메이션 OST",
      cpop: "Jay Chou, JJ Lin, Eason Chan 등의 중국/대만 가수",
      other: "다양한 장르의 아티스트",
    };

    let systemPrompt = `당신은 음악 검색 전문가입니다. 사용자 요청을 받으면 반드시 search_real_music 함수만 호출하세요.

절대 텍스트로 응답하지 말고, 오직 함수 호출만 하세요.

**중요: "${genre}" 장르만 추천하세요!**
- ${genre} 장르 아티스트만 선택: ${genreExamples[genre]}
- 다른 장르는 절대 추천하지 마세요
- 인기 있고 검증된 곡만 선택하세요`;

    // 🎯 아티스트 기반 중복 방지 (간단하고 자연스럽게)
    if (excludedSongs && excludedSongs.length > 0) {
      const artistExclusionPrompt = this.buildArtistExclusionPrompt(
        genre,
        excludedSongs
      );
      systemPrompt += artistExclusionPrompt;

      // 재시도 시에만 좀 더 강조
      if (retryAttempt && retryAttempt > 0) {
        systemPrompt += `\n\n**🔄 재시도 ${retryAttempt}회:** 음악적 다양성을 위해 새로운 아티스트의 곡을 선택해주세요.`;
      }
    }

    systemPrompt += `\n\n예시:
- 슬픈 감정 → sad context로 위로되는 ${genre} 곡 선택
- 공부할 때 → study context로 집중에 도움되는 ${genre} 곡 선택
- 운동할 때 → workout context로 에너지 넘치는 ${genre} 곡 선택

반드시 ${genre} 장르의 search_real_music 함수를 호출하세요!`;

    return systemPrompt;
  }

  // 컨텍스트 프롬프트 (기존과 동일)
  private buildContextualUserPrompt(
    prompt: string,
    context?: {
      previousMessages?: string[];
      playlistContext?: string[];
      reviewContext?: string[];
      tagContext?: string[];
      similarSongs?: string[];
      excludedSongs?: string[];
    }
  ): string {
    let contextualPrompt = `사용자 요청: "${prompt}"\n\n`;

    // 플레이리스트 컨텍스트만 간단히 추가
    if (context?.playlistContext?.length) {
      contextualPrompt += `플레이리스트 참고: ${context.playlistContext.join(
        ", "
      )}\n\n`;
    }

    contextualPrompt += `위 요청에 맞는 실제 곡을 search_real_music 함수로 추천하세요.`;

    return contextualPrompt;
  }

  // 🆕 중복 감지 메시지 생성 (사용 안함 - 삭제 예정)
  private generateDuplicateMessage(artist: string, song: string): string {
    return `🔄 "${artist} - ${song}"와 다른 새로운 곡을 찾고 있어요! 잠시만 기다려주세요... ✨`;
  }

  // 🎯 사용된 아티스트 추출 함수
  private getUsedArtists(excludedSongs: string[]): string[] {
    return excludedSongs
      .map((song) => {
        // "IU - 밤편지" → "IU" 추출
        const [artist] = song.split(" - ");
        return artist.trim();
      })
      .filter((artist, index, self) => self.indexOf(artist) === index); // 중복 제거
  }

  // 🚫 아티스트 기반 중복 방지 시스템
  private buildArtistExclusionPrompt(
    genre: MusicGenre,
    excludedSongs: string[]
  ): string {
    const usedArtists = this.getUsedArtists(excludedSongs);

    if (usedArtists.length === 0) {
      return ""; // 제외할 아티스트가 없으면 빈 문자열
    }

    return `\n\n**🎵 아티스트 다양성을 위해 제외할 아티스트들:**
${usedArtists.map((artist) => `- ${artist}`).join("\n")}

**중요:** 위 아티스트들은 이미 추천했으므로, 다른 ${genre} 아티스트의 곡을 추천해주세요.
새로운 아티스트를 통해 음악적 다양성을 제공해주세요! 🎶`;
  }
  private async retryWithDifferentSong(
    prompt: string,
    genre: MusicGenre,
    context?: {
      previousMessages?: string[];
      playlistContext?: string[];
      reviewContext?: string[];
      tagContext?: string[];
      similarSongs?: string[];
      excludedSongs?: string[];
    },
    retryCount: number = 0 // 🆕 재시도 횟수 추가
  ): Promise<{ recommendation: string; searchResult?: MusicSearchResult }> {
    console.log(`🔄 새로운 곡 찾기 재시도... (${retryCount + 1}회)`);

    // 🆕 무한 재시도 방지
    if (retryCount >= 3) {
      console.log("⚠️ 최대 재시도 횟수 초과, 플레이리스트 기반 추천으로 전환");
      return await this.getPlaylistBasedRecommendation(prompt, genre, context);
    }

    // 🆕 더 강화된 프롬프트 - 구체적인 제외 지시
    const excludedList = context?.excludedSongs || [];
    const retryPrompt = `${prompt}

**절대 추천하지 말 것 - 이미 추천한 곡들:**
${excludedList.map((song) => `- ${song}`).join("\n")}

**중요 지시사항:**
- 위 목록에 있는 곡들과 완전히 다른 ${genre} 곡만 추천
- 다른 아티스트, 다른 노래 제목 필수
- 새로운 플레이리스트에서 찾은 곡으로 추천
- ${retryCount + 1}번째 시도이므로 더욱 신중하게 선택

이번에는 반드시 새로운 곡을 추천해주세요!`;

    try {
      // 🆕 재시도 시에는 다른 접근 방법 사용
      const result = await this.getMusicRecommendationWithRealTimeSearch(
        retryPrompt,
        genre,
        {
          ...context,
          excludedSongs: excludedList,
          retryAttempt: retryCount + 1, // 재시도 정보 전달
        }
      );

      // 🆕 결과 검증 - 또 중복이면 다시 시도
      if (result.searchResult) {
        const newSongKey = `${result.searchResult.artist}-${result.searchResult.title}`;
        if (excludedList.includes(newSongKey)) {
          console.log(`🚫 재시도에서도 중복 발생: ${newSongKey}, 다시 시도...`);
          return await this.retryWithDifferentSong(
            prompt,
            genre,
            context,
            retryCount + 1
          );
        }
      }

      return result;
    } catch (error) {
      console.error(`재시도 ${retryCount + 1} 실패:`, error);
      if (retryCount < 2) {
        return await this.retryWithDifferentSong(
          prompt,
          genre,
          context,
          retryCount + 1
        );
      } else {
        // 최종 폴백
        return {
          recommendation: `죄송합니다. 새로운 곡을 찾는 데 문제가 발생했습니다. 🔄\n\n다시 시도해주시거나, 더 구체적인 감정이나 상황을 설명해주시면 더 나은 추천을 드릴 수 있어요! 😊`,
        };
      }
    }
  }

  // MV 검색 결과를 바탕으로 추천 메시지 포맷
  // MV 검색 결과를 바탕으로 추천 메시지 포맷
  private formatMVRecommendationWithResult(
    mvResult: MusicSearchResult,
    reason: string,
    context: string
  ): string {
    const contextEmojis = {
      study: "📚",
      workout: "💪",
      chill: "😌",
      sad: "💔",
      happy: "😊",
      party: "🎉",
    };

    const emoji = contextEmojis[context] || "🎵";

    let message = `${reason} ${emoji}\n\n`;
    message += `**🎵 추천곡: ${mvResult.artist} - ${mvResult.title}**\n\n`;

    // 🆕 검색 결과 페이지 링크로 변경
    message += `**🎬 뮤직비디오:**\n`;
    message += `<!-- MUSIC_LINKS:${JSON.stringify({
      youtube: {
        url: mvResult.youtubeUrl,
        label: "YouTube에서 검색하기",
      },
    })} -->\n\n`;

    message += `*검색 결과에서 원하는 버전(오피셜 MV, 퍼포먼스 등)을 선택해서 감상하세요!* ✨`;

    return message;
  }

  // MV 검색 실패 시 폴백 추천
  private generateMVFallbackRecommendation(
    artist: string,
    song: string,
    reason: string,
    context: string
  ): string {
    const contextEmojis = {
      study: "📚",
      workout: "💪",
      chill: "😌",
      sad: "💔",
      happy: "😊",
      party: "🎉",
    };

    const emoji = contextEmojis[context] || "🎵";

    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      artist + " " + song + " official mv"
    )}`;

    return `${reason} ${emoji}

**🎵 추천곡: ${artist} - ${song}**

🎬 **뮤직비디오:**
<!-- MUSIC_LINKS:${JSON.stringify({
      youtube: {
        url: youtubeSearchUrl,
        label: "YouTube에서 MV 검색하기",
      },
    })} -->

*MV 링크 생성에 실패했지만, 위 버튼으로 오피셜 뮤직비디오를 찾으실 수 있어요!*`;
  }
  private formatRecommendationWithSearchResult(
    searchResult: MusicSearchResult,
    reason: string,
    context: string
  ): string {
    const contextEmojis = {
      study: "📚",
      workout: "💪",
      chill: "😌",
      sad: "💔",
      happy: "😊",
      party: "🎉",
    };

    const emoji = contextEmojis[context] || "🎵";

    let message = `${reason} ${emoji}\n\n`;
    message += `**🎵 추천곡: ${searchResult.artist} - ${searchResult.title}**\n\n`;

    // Audio Features가 있는 경우 활용
    if (searchResult.audioFeatures) {
      const features = searchResult.audioFeatures;
      message += `**🎼 음악적 특성:**\n`;
      message += `• 에너지: ${(features.energy * 100).toFixed(0)}% `;
      message += `• 긍정성: ${(features.valence * 100).toFixed(0)}% `;
      message += `• 댄스성: ${(features.danceability * 100).toFixed(0)}%\n`;
      message += `• 템포: ${Math.round(features.tempo)} BPM\n\n`;
    }

    // 링크 정보
    message += `**🎧 플레이 링크:**\n`;
    // 🆕 YouTube 우선, 같은 곡 보장
    const youtubeUrl =
      searchResult.youtubeUrl ||
      `https://www.youtube.com/results?search_query=${encodeURIComponent(
        searchResult.artist + " " + searchResult.title + " official"
      )}`;

    message += `<!-- MUSIC_LINKS:${JSON.stringify({
      youtube: {
        url: youtubeUrl,
        label: "YouTube에서 듣기",
      },
      spotify: searchResult.spotifyUrl
        ? {
            url: searchResult.spotifyUrl,
            label: "Spotify에서 듣기",
          }
        : null,
      preview: searchResult.spotifyPreviewUrl
        ? {
            url: searchResult.spotifyPreviewUrl,
            label: "30초 미리듣기",
          }
        : null,
    })} -->\n`;

    return message;
  }

  // 검색 실패 시 폴백 추천 (기존과 동일)
  private generateFallbackRecommendation(
    artist: string,
    song: string,
    reason: string,
    context: string
  ): string {
    const contextEmojis = {
      study: "📚",
      workout: "💪",
      chill: "😌",
      sad: "💔",
      happy: "😊",
      party: "🎉",
    };

    const emoji = contextEmojis[context] || "🎵";

    return `${reason} ${emoji}

**🎵 추천곡: ${artist} - ${song}**

이 곡을 YouTube에서 검색해보세요: "${artist} ${song} official"

*실시간 링크 생성에 실패했지만, 위 검색어로 찾으실 수 있어요!*`;
  }

  // 기존의 간단한 실제 곡 추천 (폴백용) - MV만
  async getSimpleRealMusicRecommendation(
    prompt: string,
    genre: MusicGenre,
    context?: any
  ): Promise<string> {
    const enhancedPrompt = `${prompt}

**중요한 지시사항:**
- 반드시 실제 존재하는 곡만 추천하세요
- 가상의 곡이나 아티스트는 절대 만들지 마세요
- 딱 1곡만 추천하세요
- YouTube에서 뮤직비디오가 있는 정확한 곡명을 사용하세요
- 실제로 해당 상황의 플레이리스트에 포함되는 유명한 곡을 선택하세요

**응답 형식:**
[간단한 공감] 

**추천곡: [실제 아티스트] - [실제 곡명]**

[플레이리스트 맥락과 추천 이유 2-3문장]

**뮤직비디오:** "[아티스트] [곡명] official mv"`;

    const systemPrompt = `당신은 실제 존재하는 음악만 추천하는 전문가입니다.
    
절대 가상의 곡을 만들지 말고, 정말로 존재하는 유명한 ${genre} 곡만 추천하세요.
사용자 상황에 맞는 실제 플레이리스트에서 자주 볼 수 있는 곡을 선택하세요.
반드시 뮤직비디오가 있는 곡만 추천하세요.`;

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: systemPrompt + "\n\n" + enhancedPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 500,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response from Gemini API");
      }

      return data.candidates[0].content.parts[0].text || "No response";
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw new Error("Failed to get recommendation from Gemini");
    }
  }

  // 플레이리스트 구조화 (선택사항)
  async parseRecommendationToPlaylist(
    recommendation: string,
    genre: MusicGenre
  ): Promise<PlaylistRecommendation> {
    return {
      title: `${this.getGenreDisplayName(genre)} 추천 플레이리스트`,
      description: recommendation.split("\n")[0] || "맞춤 플레이리스트",
      reason: recommendation,
      songs: [],
      avgAudioFeatures: {
        energy: 0.7,
        valence: 0.6,
        danceability: 0.6,
        tempo: 120,
        acousticness: 0.3,
        instrumentalness: 0.1,
      },
    };
  }

  private getGenreDisplayName(genre: MusicGenre): string {
    const names = {
      kpop: "K-Pop",
      classical: "클래식",
      "anime-ost": "애니 OST",
      jpop: "J-Pop",
      cpop: "C-Pop",
      pop: "Pop",
      other: "다양한 장르",
    };
    return names[genre];
  }
}

// 싱글톤 인스턴스
let geminiServiceInstance: GeminiService | null = null;

export function getGeminiService(): GeminiService {
  if (!geminiServiceInstance) {
    geminiServiceInstance = new GeminiService();
  }
  return geminiServiceInstance;
}

// 기본 export
export default GeminiService;
