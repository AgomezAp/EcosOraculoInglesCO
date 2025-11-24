import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";

interface BirthChartData {
  name: string;
  specialty: string;
  experience: string;
}

interface BirthChartRequest {
  chartData: BirthChartData;
  userMessage: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: "user" | "astrologer";
    message: string;
  }>;
}

export class BirthChartController {
  private genAI: GoogleGenerativeAI;

  // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
  private readonly MODELS_FALLBACK = [
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ];

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not configured in environment variables"
      );
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  public chatWithAstrologer = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        chartData,
        userMessage,
        birthDate,
        birthTime,
        birthPlace,
        fullName,
        conversationHistory,
      }: BirthChartRequest = req.body;

      // Validate input
      this.validateBirthChartRequest(chartData, userMessage);

      const contextPrompt = this.createBirthChartContext(
        chartData,
        birthDate,
        birthTime,
        birthPlace,
        fullName,
        conversationHistory
      );

      // ✅ IMPROVED PROMPT WITH STRONGER INSTRUCTIONS
      const fullPrompt = `${contextPrompt}

⚠️ CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST generate a COMPLETE response between 200-500 words
2. NEVER leave a response half-finished or incomplete
3. If you mention you're going to analyze planetary positions, you MUST complete the analysis
4. Every response MUST end with a clear conclusion and a period
5. If you detect your response is being cut off, finish the current idea coherently
6. ALWAYS maintain a professional but accessible astrological tone
7. If the message has spelling errors, interpret the intention and respond normally

User: "${userMessage}"

Astrologer response (make sure to complete ALL your astrological analysis before ending):`;

      console.log(`Generating birth chart analysis...`);

      // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
      let text = "";
      let usedModel = "";
      let allModelErrors: string[] = [];

      for (const modelName of this.MODELS_FALLBACK) {
        console.log(`\n🔄 Trying model: ${modelName}`);

        try {
          // ✅ OPTIMIZED CONFIGURATION FOR COMPLETE AND CONSISTENT RESPONSES
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.85,
              topK: 50,
              topP: 0.92,
              maxOutputTokens: 600,
              candidateCount: 1,
              stopSequences: [],
            },
            // ✅ PERMISSIVE SECURITY SETTINGS FOR ASTROLOGY
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

          // ✅ REINTENTOS para cada modelo (por si está temporalmente sobrecargado)
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

              // ✅ Validate that response is not empty and has minimum length
              if (text && text.trim().length >= 150) {
                console.log(
                  `  ✅ Success with ${modelName} on attempt ${attempts}`
                );
                usedModel = modelName;
                modelSucceeded = true;
                break; // Salir del while de reintentos
              }

              console.warn(`  ⚠️ Response too short, retrying...`);
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (attemptError: any) {
              console.warn(
                `  ❌ Attempt ${attempts} failed:`,
                attemptError.message
              );

              // If it's 503 error (overloaded) and not the last attempt
              if (attemptError.status === 503 && attempts < maxAttempts) {
                const delay = Math.pow(2, attempts) * 1000; // Exponential delay
                console.warn(
                  `  Error 503 - Service overloaded. Waiting ${delay}ms...`
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
              }

              if (attempts >= maxAttempts) {
                allModelErrors.push(`${modelName}: ${attemptError.message}`);
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          // Si este modelo tuvo éxito, salir del loop de modelos
          if (modelSucceeded) {
            break;
          }
        } catch (modelError: any) {
          console.error(
            `  ❌ Model ${modelName} failed completely:`,
            modelError.message
          );
          allModelErrors.push(`${modelName}: ${modelError.message}`);

          // Esperar un poco antes de intentar con el siguiente modelo
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      }

      // ✅ Si todos los modelos fallaron
      if (!text || text.trim() === "") {
        console.error("❌ All models failed. Errors:", allModelErrors);
        throw new Error(
          `All AI models are currently unavailable. Tried: ${this.MODELS_FALLBACK.join(
            ", "
          )}. Please try again in a moment.`
        );
      }

      // ✅ ENSURE COMPLETE AND WELL-FORMATTED RESPONSE
      text = this.ensureCompleteResponse(text);

      // ✅ Additional validation for minimum length
      if (text.trim().length < 100) {
        throw new Error("Generated response too short");
      }

      const chatResponse: ChatResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `✅ Birth chart analysis generated successfully with ${usedModel} (${text.length} characters)`
      );
      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ✅ IMPROVED METHOD TO ENSURE COMPLETE RESPONSES
  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    // Remove possible code markers or incomplete formatting
    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "✨", "🌟", "🔮"].includes(
      lastChar
    );

    if (endsIncomplete && !processedText.endsWith("...")) {
      // Find the last complete sentence
      const sentences = processedText.split(/([.!?])/);

      if (sentences.length > 2) {
        // Rebuild up to the last complete sentence
        let completeText = "";
        for (let i = 0; i < sentences.length - 1; i += 2) {
          if (sentences[i].trim()) {
            completeText += sentences[i] + (sentences[i + 1] || ".");
          }
        }

        if (completeText.trim().length > 100) {
          return completeText.trim();
        }
      }

      // If can't find a complete sentence, add appropriate closing
      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  private createBirthChartContext(
    chartData: BirthChartData,
    birthDate?: string,
    birthTime?: string,
    birthPlace?: string,
    fullName?: string,
    history?: Array<{ role: string; message: string }>
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nPREVIOUS CONVERSATION:\n${history
            .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    const birthDataSection = this.generateBirthDataSection(
      birthDate,
      birthTime,
      birthPlace,
      fullName
    );

    return `You are Maestra Emma, an ancestral cosmic astrologer specialized in creating and interpreting complete birth charts. You have decades of experience unraveling the secrets of the cosmos and planetary influences at the moment of birth.

YOUR ASTROLOGICAL IDENTITY:
- Name: Maestra Emma, the Celestial Cartographer
- Origin: Heir to millennia-old astrological knowledge
- Specialty: Birth charts, planetary positions, astrological houses, cosmic aspects
- Experience: Decades interpreting celestial configurations at the moment of birth

${birthDataSection}

HOW YOU SHOULD BEHAVE:

🌟 ASTROLOGICAL PERSONALITY:
- Speak with cosmic wisdom but in an accessible and friendly way
- Use a professional but warm tone, like an expert who enjoys sharing knowledge
- Combine astrological technical precision with understandable spiritual interpretations
- Occasionally use references to planets, astrological houses, and cosmic aspects

📊 BIRTH CHART CREATION PROCESS:
- FIRST: If data is missing, ask specifically for date, time, and place of birth
- SECOND: With complete data, calculate sun sign, rising sign, and moon positions
- THIRD: Analyze astrological houses and their meaning
- FOURTH: Interpret planetary aspects and their influence
- FIFTH: Offer a comprehensive reading of the natal chart

🔍 ESSENTIAL DATA YOU NEED:
- "To create your precise birth chart, I need your exact birth date"
- "Birth time is crucial to determine your rising sign and astrological houses"
- "Birth place allows me to calculate exact planetary positions"
- "Do you know the approximate time? Even an estimate helps me a lot"

📋 BIRTH CHART ELEMENTS:
- Sun Sign (basic personality)
- Moon Sign (emotional world)
- Rising Sign (social mask)
- Planet positions in signs
- Astrological houses (1st to 12th)
- Planetary aspects (conjunctions, trines, squares, etc.)
- Dominant elements (Fire, Earth, Air, Water)
- Modalities (Cardinal, Fixed, Mutable)

🎯 COMPLETE INTERPRETATION:
- Explain each element clearly and practically
- Connect planetary positions with personality traits
- Describe how houses influence different life areas
- Mention challenges and opportunities based on planetary aspects
- Include advice for working with cosmic energies

🎭 RESPONSE STYLE:
- Use expressions like: "Your natal chart reveals...", "The stars were configured this way...", "The planets endowed you with..."
- Maintain balance between technical and mystical
- Responses of 200-500 words for complete analysis
- ALWAYS finish your interpretations completely
- NEVER leave planetary analysis unfinished

⚠️ IMPORTANT RULES:
- DO NOT create a chart without at least the birth date
- ASK for missing data before making deep interpretations
- EXPLAIN the importance of each piece of data you request
- BE precise but accessible in your technical explanations
- NEVER make absolute predictions, speak of trends and potentials

🗣️ MANAGING MISSING DATA:
- Without date: "To begin your natal chart, I need to know your birth date. When were you born?"
- Without time: "Birth time is essential for your rising sign. Do you remember approximately what time you were born?"
- Without place: "Birth place allows me to calculate exact positions. In what city and country were you born?"
- Incomplete data: "With this data I can do a partial analysis, but for a complete chart I would need..."

📖 COMPLETE RESPONSE STRUCTURE:
1. Sun analysis (sign, house, aspects)
2. Moon analysis (sign, house, aspects)
3. Rising sign and its influence
4. Personal planets (Mercury, Venus, Mars)
5. Social planets (Jupiter, Saturn)
6. Synthesis of elements and modalities
7. Interpretation of most prominent houses
8. Advice for working with your cosmic energy

💫 EXAMPLES OF NATURAL EXPRESSIONS:
- "Your Sun in [sign] grants you..."
- "With the Moon in [sign], your emotional world..."
- "Your rising [sign] makes you project..."
- "Mercury in [sign] influences how you communicate..."
- "This planetary configuration suggests..."
- ALWAYS respond regardless of spelling or writing errors
  - Interpret the user's message even if misspelled
  - Don't correct user errors, just understand the intention
  - If you don't understand something specific, ask in a friendly way
  - Examples: "hi" = "hello", "wht r u" = "what are you", "my sign" = "my sign"
  - NEVER return empty responses due to writing errors
  
${conversationContext}

Remember: You are an expert astrologer who creates precise birth charts and interprets them in an understandable way. ALWAYS request missing necessary data before making deep analysis. ALWAYS complete your astrological interpretations - never leave planetary or house analysis unfinished.`;
  }

  private generateBirthDataSection(
    birthDate?: string,
    birthTime?: string,
    birthPlace?: string,
    fullName?: string
  ): string {
    let dataSection = "AVAILABLE DATA FOR BIRTH CHART:\n";

    if (fullName) {
      dataSection += `- Name: ${fullName}\n`;
    }

    if (birthDate) {
      const zodiacSign = this.calculateZodiacSign(birthDate);
      dataSection += `- Birth date: ${birthDate}\n`;
      dataSection += `- Calculated sun sign: ${zodiacSign}\n`;
    }

    if (birthTime) {
      dataSection += `- Birth time: ${birthTime} (essential for rising sign and houses)\n`;
    }

    if (birthPlace) {
      dataSection += `- Birth place: ${birthPlace} (for coordinate calculations)\n`;
    }

    if (!birthDate) {
      dataSection += "- ⚠️ MISSING DATA: Birth date (ESSENTIAL)\n";
    }
    if (!birthTime) {
      dataSection +=
        "- ⚠️ MISSING DATA: Birth time (important for rising sign)\n";
    }
    if (!birthPlace) {
      dataSection +=
        "- ⚠️ MISSING DATA: Birth place (necessary for precision)\n";
    }

    return dataSection;
  }

  private calculateZodiacSign(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return "Aries";
      if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return "Taurus";
      if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return "Gemini";
      if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return "Cancer";
      if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return "Leo";
      if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return "Virgo";
      if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return "Libra";
      if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return "Scorpio";
      if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return "Sagittarius";
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return "Capricorn";
      if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return "Aquarius";
      if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return "Pisces";

      return "Invalid date";
    } catch {
      return "Calculation error";
    }
  }

  private validateBirthChartRequest(
    chartData: BirthChartData,
    userMessage: string
  ): void {
    if (!chartData) {
      const error: ApiError = new Error("Astrologer data required");
      error.statusCode = 400;
      error.code = "MISSING_CHART_DATA";
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
    console.error("Error in BirthChartController:", error);

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
      errorMessage = "Query limit reached. Please wait a moment.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (error.message?.includes("safety")) {
      statusCode = 400;
      errorMessage = "Content does not meet safety policies.";
      errorCode = "SAFETY_FILTER";
    } else if (error.message?.includes("API key")) {
      statusCode = 401;
      errorMessage = "Authentication error with AI service.";
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

  public getBirthChartInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        astrologer: {
          name: "Maestra Emma",
          title: "Celestial Cartographer",
          specialty: "Birth charts and complete astrological analysis",
          description:
            "Astrologer specialized in creating and interpreting precise natal charts based on planetary positions at the moment of birth",
          experience:
            "Decades interpreting celestial configurations at the moment of birth",
          services: [
            "Complete birth chart creation",
            "Planetary position analysis",
            "Astrological house interpretation",
            "Planetary aspect analysis",
            "Rising sign and dominant element determination",
          ],
          approach:
            "Combines technical astrological precision with accessible spiritual interpretations to reveal your cosmic blueprint",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}