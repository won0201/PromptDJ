// src/components/PromptDJ.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Mic,
  Music,
  Heart,
  Zap,
  Moon,
  Sparkles,
  ExternalLink,
  Play,
} from "lucide-react";
import type { Message, MusicGenre, FeatureMode } from "@/types";

const PromptDJ: React.FC = () => {
  // 상태 관리
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const [inputValue, setInputValue] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<MusicGenre>("kpop");
  const [currentMode, setCurrentMode] = useState<FeatureMode>("chat");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 🆕 중복 방지를 위한 추천된 곡 추적
  const [recommendedSongs, setRecommendedSongs] = useState<Set<string>>(
    new Set()
  );

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 장르 옵션
  const genres: {
    value: MusicGenre;
    label: string;
    icon: string;
    color: string;
  }[] = [
    { value: "kpop", label: "K-Pop", icon: "🇰🇷", color: "bg-pink-500" },
    { value: "classical", label: "클래식", icon: "🎼", color: "bg-purple-500" },
    { value: "anime-ost", label: "애니 OST", icon: "🎌", color: "bg-red-500" },
    { value: "jpop", label: "J-Pop", icon: "🎸", color: "bg-orange-500" },
    { value: "cpop", label: "C-Pop", icon: "🇨🇳", color: "bg-yellow-500" },
    { value: "pop", label: "Pop", icon: "🎤", color: "bg-blue-500" },
    { value: "other", label: "기타", icon: "🎵", color: "bg-gray-500" },
  ];

  // 감정 퀵 버튼들
  const emotionButtons = [
    {
      emotion: "행복해서 신나는 곡",
      icon: "😊",
      color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    },
    {
      emotion: "우울해서 위로받고 싶어",
      icon: "😢",
      color: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    },
    {
      emotion: "집중하며 공부할 때",
      icon: "📚",
      color: "bg-green-100 text-green-700 hover:bg-green-200",
    },
    {
      emotion: "운동할 때 에너지 넘치게",
      icon: "💪",
      color: "bg-red-100 text-red-700 hover:bg-red-200",
    },
    {
      emotion: "잠들기 전 차분하게",
      icon: "🌙",
      color: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
    },
    {
      emotion: "그리운 기분에 센치하게",
      icon: "🥺",
      color: "bg-purple-100 text-purple-700 hover:bg-purple-200",
    },
  ];

  // 웰컴 메시지 생성 함수
  const createWelcomeMessage = (genre: MusicGenre): Message => {
    const genreMessages = {
      kpop: "🎧 안녕하세요! K-Pop 전문 Prompt DJ입니다! 🇰🇷✨\n\n한국 음악의 매력에 빠져보세요! BTS부터 NewJeans까지, 당신의 기분에 맞는 K-Pop 플레이리스트를 찾아드려요.\n\n어떤 K-Pop 음악이 필요하신가요?",
      classical:
        "🎼 클래식 음악 전문 Prompt DJ입니다! 🎻✨\n\n바흐의 엄숙함부터 차이코프스키의 열정까지, 클래식의 깊이 있는 세계로 안내해드려요.\n\n어떤 클래식 음악이 필요하신가요?",
      "anime-ost":
        "🎌 애니메이션 OST 전문 Prompt DJ입니다! ⭐\n\n지브리 스튜디오의 감성적인 선율부터 액션 애니의 웅장한 OST까지, 2차원의 감동을 전해드려요.\n\n어떤 애니 OST가 필요하신가요?",
      jpop: "🎸 J-Pop 전문 Prompt DJ입니다! 🌸\n\n일본 대중음악의 특별한 감성을 만나보세요. 시티팝부터 최신 J-Pop까지 다양하게 추천해드려요.\n\n어떤 J-Pop 음악이 필요하신가요?",
      cpop: "🇨🇳 C-Pop 전문 Prompt DJ입니다! 🏮\n\n중화권 음악의 독특한 매력을 발견해보세요. 대만, 중국, 홍콩의 다양한 음악을 추천해드려요.\n\n어떤 C-Pop 음악이 필요하신가요?",
      pop: "🎤 팝 뮤직 전문 Prompt DJ입니다! 🌟\n\n전 세계 팝 음악의 트렌드를 만나보세요. 빌보드 차트부터 숨겨진 명곡까지 찾아드려요.\n\n어떤 팝 음악이 필요하신가요?",
      other:
        "🎵 올장르 전문 Prompt DJ입니다! 🌈\n\n록, 힙합, 재즈, 인디, 월드뮤직까지! 모든 장르의 음악을 아우르며 당신만의 플레이리스트를 만들어드려요.\n\n어떤 음악이 필요하신가요?",
    };

    return {
      id: `welcome-${genre}`,
      type: "bot",
      content: genreMessages[genre],
      timestamp: new Date(),
    };
  };

  // 초기화 효과 (클라이언트에서만 실행)
  useEffect(() => {
    if (!isInitialized) {
      const welcomeMessage = createWelcomeMessage(selectedGenre);
      setMessages([welcomeMessage]);
      setIsInitialized(true);
    }
  }, [isInitialized, selectedGenre]);

  // 장르 변경 시 대화 내역 초기화 + 추천 기록 초기화
  useEffect(() => {
    if (isInitialized) {
      const welcomeMessage = createWelcomeMessage(selectedGenre);
      setMessages([welcomeMessage]);
      setInputValue(""); // 입력창도 초기화
      setIsLoading(false); // 로딩 상태도 초기화
      setRecommendedSongs(new Set()); // 🆕 추천 기록 초기화
    }
  }, [selectedGenre, isInitialized]);

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 향상된 메시지 전송 (컨텍스트 분석 + 중복 방지 포함)
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: inputValue,
      timestamp: new Date(),
      genre: selectedGenre,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      // 이전 메시지들 준비 (컨텍스트용)
      const previousMessages = messages
        .slice(-4) // 최근 4개 메시지
        .map((m) => `${m.type}: ${m.content}`);

      // 🆕 추천된 곡 목록을 API에 전달
      const recommendedSongsList = Array.from(recommendedSongs);

      // 향상된 Gemini API 호출
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: currentInput,
          genre: selectedGenre,
          previousMessages,
          excludedSongs: recommendedSongsList, // 🆕 중복 방지용
        }),
      });

      const data = await response.json();

      if (data.success) {
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: "bot",
          content: data.recommendation,
          timestamp: new Date(),
          llmProvider: "gemini",
          analysis: data.analysis, // 분석 결과 포함
        };
        setMessages((prev) => [...prev, botMessage]);

        // 🆕 새로 추천된 곡을 기록에 추가
        if (data.analysis?.searchResult) {
          const songKey = `${data.analysis.searchResult.artist}-${data.analysis.searchResult.title}`;
          setRecommendedSongs((prev) => new Set(prev).add(songKey));
          console.log("🎵 새로 추천된 곡 추가:", songKey);
          console.log("📝 현재 추천 기록:", Array.from(recommendedSongs));
        }

        // 분석 결과 로깅 (개발용)
        if (data.analysis) {
          console.log("Context Analysis:", data.analysis);
          if (data.analysis.playlistSource) {
            console.log("🎯 플레이리스트 출처:", data.analysis.playlistSource);
          }
        }
      } else {
        throw new Error(data.error || "Failed to get recommendation");
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: "bot",
        content: `🚨 죄송해요! 추천을 가져오는 중에 문제가 발생했어요.\n\n오류: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }\n\n다시 시도해주세요! 🙏`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 감정 버튼 클릭
  const handleEmotionClick = (emotion: string) => {
    setCurrentMode("mood-recommendation");
    setInputValue(emotion);
  };

  // 음성 녹음 토글 (임시)
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    setCurrentMode("song-finder");

    if (!isRecording) {
      // 녹음 시작 시뮬레이션
      setTimeout(() => {
        setInputValue("음성 인식 기능은 곧 추가됩니다!");
        setIsRecording(false);
      }, 3000);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* 헤더 */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Music className="w-8 h-8 text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">DJ</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Prompt DJ</h1>
              <p className="text-xs text-white/70">
                AI-Powered Playlist Curator
              </p>
            </div>
          </div>

          {/* 장르 선택 */}
          <div className="flex space-x-1">
            {genres.map((genre) => (
              <button
                key={genre.value}
                onClick={() => setSelectedGenre(genre.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all transform hover:scale-105 ${
                  selectedGenre === genre.value
                    ? "bg-white text-purple-900 shadow-lg scale-105"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
                title={`${genre.label} 전용 모드로 전환 (대화 내역이 초기화됩니다)`}
              >
                {genre.icon} {genre.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </AnimatePresence>

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* 감정 퀵 버튼들 */}
      <div className="px-4 py-2">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {emotionButtons.map((btn) => (
            <button
              key={btn.emotion}
              onClick={() => handleEmotionClick(btn.emotion)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${btn.color}`}
            >
              {btn.icon} {btn.emotion}
            </button>
          ))}
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="bg-white/10 backdrop-blur-lg border-t border-white/20 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="어떤 음악이 필요하세요? (예: 비 오는 날 센치한 기분에 어울리는 플레이리스트)"
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <button
            onClick={toggleRecording}
            className={`p-3 rounded-lg transition-all ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : "bg-white/20 hover:bg-white/30"
            }`}
            title="노래 흥얼거리기 / 가사로 찾기"
          >
            <Mic className="w-5 h-5 text-white" />
          </button>

          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

// 메시지 버블 컴포넌트 (음악 링크 버튼 포함)
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.type === "user";

  // 음악 링크 파싱 함수
  const parseMusicLinks = (content: string) => {
    const linkMatch = content.match(/<!-- MUSIC_LINKS:(.*?) -->/);
    if (linkMatch) {
      try {
        const links = JSON.parse(linkMatch[1]);
        const cleanContent = content.replace(/<!-- MUSIC_LINKS:.*? -->\n?/, "");
        return { content: cleanContent, links };
      } catch (e) {
        return { content, links: null };
      }
    }
    return { content, links: null };
  };

  const { content, links } = parseMusicLinks(message.content);

  // 링크 버튼 렌더링
  const renderMusicButtons = (links: any) => {
    if (!links) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {links.youtube && (
          <a
            href={links.youtube.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all transform hover:scale-105 text-sm font-medium"
          >
            <Play className="w-4 h-4" />
            <span>{links.youtube.label}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {links.spotify && (
          <a
            href={links.spotify.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all transform hover:scale-105 text-sm font-medium"
          >
            <Music className="w-4 h-4" />
            <span>{links.spotify.label}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {links.preview && (
          <a
            href={links.preview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all transform hover:scale-105 text-sm font-medium"
          >
            <Play className="w-4 h-4" />
            <span>{links.preview.label}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-4xl ${
          isUser
            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
            : "bg-white/20 backdrop-blur-lg text-white border border-white/30"
        } rounded-lg p-4 space-y-3`}
      >
        <p className="whitespace-pre-wrap">{content}</p>

        {/* 음악 링크 버튼들 */}
        {!isUser && renderMusicButtons(links)}

        <div className="text-xs opacity-70">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
};

// 타이핑 인디케이터
const TypingIndicator: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex justify-start"
    >
      <div className="bg-white/20 backdrop-blur-lg rounded-lg p-4 border border-white/30">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
                className="w-2 h-2 bg-white rounded-full"
              />
            ))}
          </div>
          <span className="text-sm text-white/80">
            DJ가 완벽한 플레이리스트를 찾고 있어요...
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default PromptDJ;
