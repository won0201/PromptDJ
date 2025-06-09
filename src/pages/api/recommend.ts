// src/pages/api/recommend.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getGeminiService } from "@/services/geminiService";
import {
  extractContextFromPrompt,
  generateContextualRecommendation,
} from "@/data/musicContext";
import type { MusicGenre } from "@/types";

interface RecommendRequest {
  prompt: string;
  genre: MusicGenre;
  previousMessages?: string[];
  excludedSongs?: string[]; // 🆕 중복 방지용
}

interface RecommendResponse {
  success: boolean;
  recommendation?: string;
  analysis?: {
    extractedContext: any;
    searchResult?: any;
    confidence: number;
    playlistSource?: string; // 🆕 어떤 플레이리스트에서 찾았는지
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RecommendResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const { prompt, genre, previousMessages, excludedSongs }: RecommendRequest =
      req.body;

    // 입력 유효성 검사
    if (!prompt || !genre) {
      return res.status(400).json({
        success: false,
        error: "Prompt and genre are required",
      });
    }

    // 🔍 디버깅 로그 추가
    console.log("🚀 API: 새로운 추천 요청");
    console.log("📝 프롬프트:", prompt);
    console.log("🎵 장르:", genre);
    console.log("🚫 제외할 곡들:", excludedSongs?.length || 0, "개");

    // 사용자 프롬프트에서 컨텍스트 추출
    const extractedContext = extractContextFromPrompt(prompt);

    // 컨텍스트 기반 추가 정보 생성
    const contextualInfo = generateContextualRecommendation(
      prompt,
      extractedContext
    );

    // 이전 메시지 추가
    if (previousMessages && previousMessages.length > 0) {
      contextualInfo.previousMessages = previousMessages.slice(-3); // 최근 3개만
    }

    // 🆕 중복 방지 정보 추가
    if (excludedSongs && excludedSongs.length > 0) {
      contextualInfo.excludedSongs = excludedSongs;
      console.log("🚫 중복 방지 활성화:", excludedSongs);
    }

    // Gemini 서비스 인스턴스 가져오기
    const geminiService = getGeminiService();

    console.log("🎯 플레이리스트 기반 추천 시작...");

    // 🆕 플레이리스트 기반 추천 사용
    const result = await geminiService.getPlaylistBasedRecommendation(
      prompt,
      genre,
      contextualInfo
    );

    console.log("✅ API: 추천 완료");
    if (result.playlistSource) {
      console.log("📂 플레이리스트 출처:", result.playlistSource);
    }

    // 분석 결과와 함께 응답
    return res.status(200).json({
      success: true,
      recommendation: result.recommendation,
      analysis: {
        extractedContext,
        searchResult: result.searchResult,
        confidence: calculateConfidence(extractedContext, contextualInfo),
        playlistSource: result.playlistSource, // 🆕 어떤 플레이리스트에서 찾았는지
      },
    });
  } catch (error) {
    // 🚨 더 자세한 에러 로깅
    console.error("🚨 API 전체 에러:", error);
    console.error(
      "🔍 에러 스택:",
      error instanceof Error ? error.stack : "No stack"
    );

    // 에러 타입별 상세 정보
    if (error instanceof Error) {
      console.error("❌ 에러 이름:", error.name);
      console.error("❌ 에러 메시지:", error.message);
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      // 개발 환경에서는 더 자세한 정보 제공
      ...(process.env.NODE_ENV === "development" && {
        details: error instanceof Error ? error.stack : String(error),
      }),
    });
  }
}

// 추천 신뢰도 계산
function calculateConfidence(
  extractedContext: any,
  contextualInfo: any
): number {
  let confidence = 0.5; // 기본값

  // 추출된 활동이 있으면 신뢰도 증가
  if (extractedContext.activities.length > 0) {
    confidence += 0.2;
  }

  // 추출된 감정이 있으면 신뢰도 증가
  if (extractedContext.moods.length > 0) {
    confidence += 0.2;
  }

  // 플레이리스트 컨텍스트가 있으면 신뢰도 증가
  if (
    contextualInfo.playlistContext &&
    contextualInfo.playlistContext.length > 0
  ) {
    confidence += 0.1;
  }

  // 🆕 중복 방지가 활성화되어 있으면 신뢰도 증가 (더 정교한 추천)
  if (contextualInfo.excludedSongs && contextualInfo.excludedSongs.length > 0) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}
