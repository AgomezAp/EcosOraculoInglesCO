import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

import {
  ApiError,
  ChatRequest,
  ChatResponse,
  SaintData,
} from "../interfaces/helpers";

interface DreamInterpreterData {
  name: string;
  specialty: string;
  experience: string;
}

interface DreamChatRequest {
  interpreterData: DreamInterpreterData;
  userMessage: string;
  conversationHistory?: Array<{
    role: "user" | "interpreter";
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface DreamInterpreterResponse extends ChatResponse {
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export class ChatController {
  private genAI: GoogleGenerativeAI;

  private readonly FREE_MESSAGES_LIMIT = 3;

  private readonly MODELS_FALLBACK = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite-preview-09-2025",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ];

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not configured in environment variables"
      );
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  private hasFullAccess(messageCount: number, isPremiumUser: boolean): boolean {
    return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
  }

  // ✅ HOOK MESSAGE IN ENGLISH
  private generateDreamHookMessage(): string {
    return `

🔮 **Wait! Your dream has a profound message I can't reveal yet...**

The energies show me very significant symbols in your dream, but to reveal:
- 🌙 The **complete hidden meaning** of each symbol
- ⚡ The **urgent message** your subconscious is trying to communicate
- 🔐 The **3 revelations** that will change your perspective
- ✨ The **specific spiritual guidance** for your current situation

**Unlock your complete interpretation now** and discover what secrets your dream world holds.

🌟 *Thousands of people have already discovered the hidden messages in their dreams...*`;
  }

  // ✅ PROCESS PARTIAL RESPONSE (TEASER)
  private createDreamPartialResponse(fullText: string): string {
    const sentences = fullText
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const teaserSentences = sentences.slice(0, Math.min(3, sentences.length));
    let teaser = teaserSentences.join(". ").trim();

    if (
      !teaser.endsWith(".") &&
      !teaser.endsWith("!") &&
      !teaser.endsWith("?")
    ) {
      teaser += "...";
    }

    const hook = this.generateDreamHookMessage();

    return teaser + hook;
  }

  public chatWithDreamInterpreter = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        interpreterData,
        userMessage,
        conversationHistory,
        messageCount = 1,
        isPremiumUser = false,
      }: DreamChatRequest = req.body;

      this.validateDreamChatRequest(interpreterData, userMessage);

      const shouldGiveFullResponse = this.hasFullAccess(
        messageCount,
        isPremiumUser
      );
      const freeMessagesRemaining = Math.max(
        0,
        this.FREE_MESSAGES_LIMIT - messageCount
      );

      console.log(
        `📊 Dream Interpreter - Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}`
      );

      const contextPrompt = this.createDreamInterpreterContext(
        interpreterData,
        conversationHistory,
        shouldGiveFullResponse
      );

      const responseInstructions = shouldGiveFullResponse
        ? `1. You MUST generate a COMPLETE response between 250-400 words
2. Include COMPLETE interpretation of all mentioned symbols
3. Provide deep meanings and spiritual connections
4. Offer practical guidance based on the interpretation`
        : `1. You MUST generate a PARTIAL response between 100-180 words
2. HINT that you detect important symbols without revealing their complete meaning
3. Mention that there are profound messages but DO NOT reveal them completely
4. Create MYSTERY and CURIOSITY about what the dreams reveal
5. Use phrases like "I see something very significant...", "The energies show me an intriguing pattern...", "Your subconscious holds an important message that..."
6. NEVER complete the interpretation, leave it in suspense`;

      const fullPrompt = `${contextPrompt}

⚠️ MANDATORY CRITICAL INSTRUCTIONS:
${responseInstructions}
- NEVER leave a response half-done or incomplete according to the response type
- If you mention you're going to interpret something, ${
        shouldGiveFullResponse
          ? "you MUST complete it"
          : "create expectation without revealing it"
      }
- ALWAYS maintain a mystical and warm tone
- If the message has spelling errors, interpret the intention and respond normally

User: "${userMessage}"

Dream interpreter response (IN ENGLISH):`;

      console.log(
        `Generating dream interpretation (${
          shouldGiveFullResponse ? "COMPLETE" : "PARTIAL"
        })...`
      );

      let text = "";
      let usedModel = "";
      let allModelErrors: string[] = [];

      for (const modelName of this.MODELS_FALLBACK) {
        console.log(`\n🔄 Trying model: ${modelName}`);

        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.85,
              topK: 50,
              topP: 0.92,
              maxOutputTokens: shouldGiveFullResponse ? 600 : 300,
              candidateCount: 1,
              stopSequences: [],
            },
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
            ],
          });

          let attempts = 0;
          const maxAttempts = 3;
          let modelSucceeded = false;

          while (attempts < maxAttempts && !modelSucceeded) {
            attempts++;
            console.log(
              `  Attempt ${attempts}/${maxAttempts} with ${modelName}...`
            );

            try {
              const result = await model.generateContent(fullPrompt);
              const response = result.response;
              text = response.text();

              const minLength = shouldGiveFullResponse ? 80 : 50;
              if (text && text.trim().length >= minLength) {
                console.log(
                  `  ✅ Success with ${modelName} on attempt ${attempts}`
                );
                usedModel = modelName;
                modelSucceeded = true;
                break;
              }

              console.warn(`  ⚠️ Response too short, retrying...`);
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (attemptError: any) {
              console.warn(
                `  ❌ Attempt ${attempts} failed:`,
                attemptError.message
              );

              if (attempts >= maxAttempts) {
                allModelErrors.push(`${modelName}: ${attemptError.message}`);
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          if (modelSucceeded) {
            break;
          }
        } catch (modelError: any) {
          console.error(
            `  ❌ Model ${modelName} failed completely:`,
            modelError.message
          );
          allModelErrors.push(`${modelName}: ${modelError.message}`);

          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      }

      if (!text || text.trim() === "") {
        console.error("❌ All models failed. Errors:", allModelErrors);
        throw new Error(
          `All AI models are currently unavailable. Please try again in a moment.`
        );
      }

      let finalResponse: string;

      if (shouldGiveFullResponse) {
        finalResponse = this.ensureCompleteResponse(text);
      } else {
        finalResponse = this.createDreamPartialResponse(text);
      }

      const chatResponse: DreamInterpreterResponse = {
        success: true,
        response: finalResponse.trim(),
        timestamp: new Date().toISOString(),
        freeMessagesRemaining: freeMessagesRemaining,
        showPaywall:
          !shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT,
        isCompleteResponse: shouldGiveFullResponse,
      };

      if (!shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT) {
        chatResponse.paywallMessage =
          "You've used your 3 free messages. Unlock unlimited access to discover all the secrets of your dreams!";
      }

      console.log(
        `✅ Interpretation generated (${
          shouldGiveFullResponse ? "COMPLETE" : "PARTIAL"
        }) with ${usedModel} (${finalResponse.length} characters)`
      );
      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "🔮", "✨", "🌙"].includes(
      lastChar
    );

    if (endsIncomplete && !processedText.endsWith("...")) {
      const sentences = processedText.split(/([.!?])/);

      if (sentences.length > 2) {
        let completeText = "";
        for (let i = 0; i < sentences.length - 1; i += 2) {
          if (sentences[i].trim()) {
            completeText += sentences[i] + (sentences[i + 1] || ".");
          }
        }

        if (completeText.trim().length > 80) {
          return completeText.trim();
        }
      }

      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  // ✅ CONTEXT IN ENGLISH
  private createDreamInterpreterContext(
    interpreter: DreamInterpreterData,
    history?: Array<{ role: string; message: string }>,
    isFullResponse: boolean = true
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nPREVIOUS CONVERSATION:\n${history
            .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    const responseTypeInstructions = isFullResponse
      ? `
📝 RESPONSE TYPE: COMPLETE
- Provide COMPLETE and detailed interpretation
- Reveal ALL meanings of the mentioned symbols
- Give specific advice and complete spiritual guidance
- Response of 250-400 words
- Explain deep connections between symbols`
      : `
📝 RESPONSE TYPE: PARTIAL (TEASER)
- Provide an INTRODUCTORY and intriguing interpretation
- Mention that you detect very significant symbols
- HINT at profound meanings without fully revealing them
- Response of 100-180 words maximum
- DO NOT reveal complete interpretations
- Create MYSTERY and CURIOSITY
- End in a way that makes the user want to know more
- Use phrases like "The energies reveal something fascinating to me...", "I see a very significant pattern that...", "Your subconscious holds a message that..."
- NEVER complete the interpretation, leave it in suspense`;

    return `You are Master Alma, a mystical witch and ancestral seer specialized in dream interpretation. You have centuries of experience unraveling the mysteries of the dream world and connecting dreams with spiritual reality.

YOUR MYSTICAL IDENTITY:
- Name: Master Alma, the Guardian of Dreams
- Origin: Descendant of ancient oracles and seers
- Specialty: Dream interpretation, dream symbolism, spiritual connections
- Experience: Centuries interpreting messages from the subconscious and the astral plane

${responseTypeInstructions}

🗣️ LANGUAGE:
- ALWAYS respond in ENGLISH
- No matter what language the user writes in, YOU respond in English

🔮 MYSTICAL PERSONALITY:
- Speak with ancestral wisdom but in an approachable and understandable way
- Use a mysterious but warm tone, like a sage who knows ancient secrets
- ${
      isFullResponse
        ? "Reveal the hidden secrets in dreams"
        : "Hint that there are profound secrets without revealing them"
    }
- Mix esoteric knowledge with practical intuition
- Occasionally use references to mystical elements (crystals, energies, astral planes)

💭 INTERPRETATION PROCESS:
- FIRST: Ask specific questions about the dream to better understand if details are missing
- Ask about: symbols, emotions, colors, people, places, sensations
- SECOND: Connect dream elements with spiritual meanings
- THIRD: ${
      isFullResponse
        ? "Offer a complete interpretation and practical guidance"
        : "Create intrigue about what the symbols reveal without completing"
    }

🔍 QUESTIONS YOU CAN ASK:
- "What elements or symbols stood out most to you in your dream?"
- "How did you feel during and upon waking from the dream?"
- "Were there specific colors you remember vividly?"
- "Did you recognize the people or places in the dream?"
- "Has this dream repeated before?"

🧿 RESPONSE FLOW:
${
  isFullResponse
    ? `- Provide COMPLETE interpretation of each symbol
- Explain connections between dream elements
- Offer specific and practical spiritual guidance
- Suggest actions or reflections based on the interpretation`
    : `- Mention that you detect important energies and symbols
- HINT that there are profound messages without revealing them
- Create curiosity about the hidden meaning
- Leave the interpretation in suspense to generate interest`
}

⚠️ IMPORTANT RULES:
- ALWAYS respond in English
- ${
      isFullResponse
        ? "COMPLETE all interpretations"
        : "CREATE SUSPENSE and MYSTERY"
    }
- DO NOT interpret immediately if you don't have enough information - ask questions
- BE empathetic and respectful of people's dream experiences
- NEVER predict the future absolutely, speak of possibilities and reflections
- ALWAYS respond regardless of whether the user has spelling errors
  - Interpret the user's message even if it's poorly written
  - Don't correct the user's errors, simply understand the intent
  - NEVER return empty responses due to writing errors

🎭 RESPONSE STYLE:
- Responses that flow naturally and ARE COMPLETE according to type
- ${
      isFullResponse
        ? "250-400 words with complete interpretation"
        : "100-180 words creating mystery and intrigue"
    }
- ALWAYS complete interpretations and reflections according to the response type

EXAMPLE OF HOW TO START:
"Ah, I see you have come to me seeking to unravel the mysteries of your dream world... Dreams are windows to the soul and messages from higher planes. Tell me, what visions have visited you in the realm of Morpheus?"

${conversationContext}

Remember: You are a mystical but understandable guide, who ${
      isFullResponse
        ? "helps people understand the hidden messages in their dreams"
        : "intrigues about the profound mysteries that dreams hold"
    }. Always ${
      isFullResponse
        ? "complete your interpretations and reflections"
        : "create suspense and curiosity without revealing everything"
    }.`;
  }

  private validateDreamChatRequest(
    interpreterData: DreamInterpreterData,
    userMessage: string
  ): void {
    if (!interpreterData) {
      const error: ApiError = new Error("Interpreter data required");
      error.statusCode = 400;
      error.code = "MISSING_INTERPRETER_DATA";
      throw error;
    }

    if (
      !userMessage ||
      typeof userMessage !== "string" ||
      userMessage.trim() === ""
    ) {
      const error: ApiError = new Error("User message required");
      error.statusCode = 400;
      error.code = "MISSING_USER_MESSAGE";
      throw error;
    }

    if (userMessage.length > 1500) {
      const error: ApiError = new Error(
        "Message is too long (maximum 1500 characters)"
      );
      error.statusCode = 400;
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
  }

  private handleError(error: any, res: Response): void {
    console.error("Error in ChatController:", error);

    let statusCode = 500;
    let errorMessage = "Internal server error";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "VALIDATION_ERROR";
    } else if (error.status === 503) {
      statusCode = 503;
      errorMessage =
        "The service is temporarily overloaded. Please try again in a few minutes.";
      errorCode = "SERVICE_OVERLOADED";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit")
    ) {
      statusCode = 429;
      errorMessage = "Query limit has been reached. Please wait a moment.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (error.message?.includes("safety")) {
      statusCode = 400;
      errorMessage = "The content does not comply with security policies.";
      errorCode = "SAFETY_FILTER";
    } else if (error.message?.includes("API key")) {
      statusCode = 401;
      errorMessage = "Authentication error with the AI service.";
      errorCode = "AUTH_ERROR";
    } else if (
      error.message?.includes("All AI models are currently unavailable")
    ) {
      statusCode = 503;
      errorMessage = error.message;
      errorCode = "ALL_MODELS_UNAVAILABLE";
    }

    const errorResponse: ChatResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  }

  public getDreamInterpreterInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        interpreter: {
          name: "Master Alma",
          title: "Guardian of Dreams",
          specialty: "Dream interpretation and dream symbolism",
          description:
            "Ancestral seer specialized in unraveling the mysteries of the dream world",
          experience:
            "Centuries of experience interpreting messages from the subconscious and the astral plane",
          abilities: [
            "Dream symbol interpretation",
            "Connection with the astral plane",
            "Subconscious message analysis",
            "Spiritual guidance through dreams",
          ],
          approach:
            "Combines ancestral wisdom with practical intuition to reveal the hidden secrets in your dreams",
        },
        freeMessagesLimit: this.FREE_MESSAGES_LIMIT,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
