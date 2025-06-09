// src/data/musicContext.ts

// 플레이리스트 컨텍스트별 분류
export const PLAYLIST_CONTEXTS = {
  // 운동/에너지
  workout: {
    keywords: [
      "Beast Mode",
      "Pump It Up",
      "Gym Motivation",
      "Power Workout",
      "Running Hits",
      "Cardio Mix",
      "Strength Training",
      "HIIT Playlist",
      "운동",
      "헬스",
      "파워",
    ],
    characteristics: {
      energy: 0.8,
      valence: 0.7,
      danceability: 0.7,
      tempo: "fast",
    },
  },

  // 차분함/공부
  chill: {
    keywords: [
      "Chill Vibes",
      "Lo-Fi Study",
      "Rainy Day",
      "Lazy Sunday",
      "Coffee Shop",
      "Midnight Chill",
      "Relaxing Evening",
      "Peaceful",
      "공부",
      "집중",
      "카페",
    ],
    characteristics: {
      energy: 0.3,
      valence: 0.5,
      danceability: 0.3,
      tempo: "slow",
    },
  },

  // 파티/댄스
  party: {
    keywords: [
      "Party Hits",
      "Dance Floor",
      "Club Bangers",
      "House Party",
      "Friday Night",
      "Turn Up",
      "Party Anthems",
      "Dance Mix",
      "파티",
      "클럽",
      "댄스",
    ],
    characteristics: {
      energy: 0.9,
      valence: 0.8,
      danceability: 0.9,
      tempo: "fast",
    },
  },

  // 드라이브
  drive: {
    keywords: [
      "Road Trip",
      "Highway Driving",
      "Car Ride",
      "Cruise Control",
      "Windows Down",
      "Drive Time",
      "Journey Playlist",
      "Open Road",
      "드라이브",
      "여행",
    ],
    characteristics: {
      energy: 0.6,
      valence: 0.7,
      danceability: 0.5,
      tempo: "medium",
    },
  },

  // 슬픔/감성
  sad: {
    keywords: [
      "Breakup Songs",
      "Sad Vibes",
      "Heartbreak Playlist",
      "Melancholy",
      "Crying Songs",
      "Emotional",
      "Feelings",
      "Sadcore",
      "이별",
      "슬픔",
      "감성",
    ],
    characteristics: {
      energy: 0.2,
      valence: 0.2,
      danceability: 0.2,
      tempo: "slow",
    },
  },

  // 행복/기분좋음
  happy: {
    keywords: [
      "Good Vibes",
      "Feel Good",
      "Happy Songs",
      "Uplifting",
      "Mood Booster",
      "Sunshine",
      "Positive Energy",
      "Joy",
      "기분좋은",
      "신나는",
      "밝은",
    ],
    characteristics: {
      energy: 0.7,
      valence: 0.9,
      danceability: 0.6,
      tempo: "medium",
    },
  },

  // 로맨틱
  romantic: {
    keywords: [
      "Love Songs",
      "Romantic",
      "Date Night",
      "Wedding",
      "Anniversary",
      "Valentine",
      "사랑",
      "로맨틱",
      "데이트",
    ],
    characteristics: {
      energy: 0.4,
      valence: 0.8,
      danceability: 0.3,
      tempo: "slow",
    },
  },

  // 힙합/랩
  hiphop: {
    keywords: [
      "Hip Hop",
      "Rap Hits",
      "Trap",
      "Urban",
      "Street",
      "Freestyle",
      "힙합",
      "랩",
    ],
    characteristics: {
      energy: 0.7,
      valence: 0.6,
      danceability: 0.8,
      tempo: "medium",
    },
  },
};

// 리뷰 키워드별 특성
export const REVIEW_CONTEXTS = {
  energetic: {
    keywords: [
      "에너지 넘치는",
      "신나는",
      "강렬한",
      "파워풀한",
      "역동적인",
      "energetic",
      "powerful",
      "intense",
      "driving",
      "pumping",
      "upbeat",
    ],
    weight: { energy: 0.9, valence: 0.7, danceability: 0.7 },
  },

  chill: {
    keywords: [
      "잔잔한",
      "편안한",
      "차분한",
      "여유로운",
      "평화로운",
      "chill",
      "mellow",
      "relaxing",
      "soothing",
      "calm",
      "peaceful",
    ],
    weight: { energy: 0.2, valence: 0.6, danceability: 0.3 },
  },

  emotional: {
    keywords: [
      "감동적인",
      "눈물나는",
      "마음에 와닿는",
      "감성적인",
      "emotional",
      "touching",
      "heartfelt",
      "moving",
      "poignant",
    ],
    weight: { energy: 0.3, valence: 0.3, danceability: 0.2 },
  },

  dance: {
    keywords: [
      "춤추고 싶은",
      "리듬감 있는",
      "그루브한",
      "비트감 좋은",
      "danceable",
      "groovy",
      "rhythmic",
      "funky",
      "bouncy",
    ],
    weight: { energy: 0.7, valence: 0.7, danceability: 0.9 },
  },

  motivational: {
    keywords: [
      "동기부여",
      "격려",
      "힘나는",
      "응원",
      "motivational",
      "inspiring",
      "uplifting",
      "encouraging",
    ],
    weight: { energy: 0.8, valence: 0.8, danceability: 0.6 },
  },
};

// 사용자 요청에서 컨텍스트 추출
export function extractContextFromPrompt(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();
  const extractedContexts = {
    playlists: [] as string[],
    useCases: [] as string[],
    moods: [] as string[],
    activities: [] as string[],
  };

  // 활동 키워드 매칭
  const activityKeywords = {
    workout: ["운동", "헬스", "gym", "workout", "exercise", "fitness"],
    study: ["공부", "집중", "study", "focus", "concentration", "work"],
    party: ["파티", "party", "club", "dance", "celebration"],
    drive: ["드라이브", "drive", "car", "road", "travel", "journey"],
    relax: ["휴식", "relax", "chill", "rest", "calm", "peaceful"],
    sleep: ["잠", "sleep", "night", "bedtime", "lullaby"],
  };

  for (const [activity, keywords] of Object.entries(activityKeywords)) {
    if (keywords.some((keyword) => lowerPrompt.includes(keyword))) {
      extractedContexts.activities.push(activity);
    }
  }

  // 감정 키워드 매칭
  const moodKeywords = {
    happy: ["기분좋은", "신나는", "행복한", "happy", "joyful", "upbeat"],
    sad: ["슬픈", "우울한", "sad", "melancholy", "depressed", "blue"],
    energetic: ["에너지틱한", "활기찬", "energetic", "powerful", "dynamic"],
    romantic: ["로맨틱한", "사랑", "romantic", "love", "sweet", "tender"],
    angry: ["화난", "분노", "angry", "mad", "fierce", "aggressive"],
  };

  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    if (keywords.some((keyword) => lowerPrompt.includes(keyword))) {
      extractedContexts.moods.push(mood);
    }
  }

  return extractedContexts;
}

// 컨텍스트 기반 추천 생성 도우미
export function generateContextualRecommendation(
  userPrompt: string,
  extractedContext: any
) {
  const contexts = {
    previousMessages: [] as string[],
    playlistContext: [] as string[],
    reviewContext: [] as string[],
    tagContext: [] as string[],
    similarSongs: [] as string[],
  };

  // 활동별 플레이리스트 컨텍스트 추가
  if (extractedContext.activities.includes("workout")) {
    contexts.playlistContext.push(
      "Spotify 'Beast Mode' 플레이리스트에 자주 등장하는 스타일",
      "Apple Music 'Power Workout' 플레이리스트 특성",
      "헬스장에서 인기 있는 고에너지 음악"
    );
    contexts.reviewContext.push(
      "사용자들이 '운동할 때 최고!'라고 평가",
      "높은 BPM과 강렬한 비트로 유명",
      "동기부여에 효과적인 에너지틱한 곡"
    );
    contexts.tagContext.push(
      "#workout",
      "#energetic",
      "#motivation",
      "#high-energy"
    );
  }

  if (extractedContext.activities.includes("study")) {
    contexts.playlistContext.push(
      "Spotify 'Lo-Fi Study Beats' 플레이리스트 스타일",
      "YouTube 'Study with Me' 플레이리스트에 포함",
      "도서관/카페에서 많이 들리는 배경음악"
    );
    contexts.reviewContext.push(
      "집중할 때 방해되지 않는 음악",
      "가사 없는 차분한 멜로디로 인기",
      "장시간 듣기에 좋은 잔잔한 곡"
    );
    contexts.tagContext.push("#study", "#focus", "#ambient", "#instrumental");
  }

  if (extractedContext.moods.includes("sad")) {
    contexts.playlistContext.push(
      "Spotify 'Sad Songs' 플레이리스트의 대표곡",
      "Apple Music 'Heartbreak' 플레이리스트에 포함",
      "이별/감성 플레이리스트에서 자주 발견"
    );
    contexts.reviewContext.push(
      "눈물나는 가사와 멜로디로 유명",
      "감정 해소에 도움되는 곡으로 평가",
      "힘든 시기에 위로가 되는 음악"
    );
    contexts.tagContext.push("#sad", "#emotional", "#ballad", "#heartbreak");
  }

  if (extractedContext.moods.includes("happy")) {
    contexts.playlistContext.push(
      "Spotify 'Good Vibes' 플레이리스트의 단골곡",
      "Apple Music 'Feel Good' 플레이리스트에 포함",
      "기분전환용 플레이리스트에서 인기"
    );
    contexts.reviewContext.push(
      "듣기만 해도 기분이 좋아지는 곡",
      "밝고 경쾌한 멜로디로 사랑받음",
      "스트레스 해소에 효과적"
    );
    contexts.tagContext.push("#happy", "#uplifting", "#feel-good", "#positive");
  }

  return contexts;
}
