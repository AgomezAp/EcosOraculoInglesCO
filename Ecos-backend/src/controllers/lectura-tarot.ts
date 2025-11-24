import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatRequest, ChatResponse } from "../interfaces/helpers";

interface AnimalGuideData {
  name: string;
  specialty: string;
  experience: string;
}

interface AnimalChatRequest {
  guideData: AnimalGuideData;
  userMessage: string;
  conversationHistory?: Array<{
    role: "user" | "guide";
    message: string;
  }>;
}

export class AnimalInteriorController {
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

  public chatWithAnimalGuide = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { guideData, userMessage, conversationHistory }: AnimalChatRequest =
        req.body;

      // Validate input
      this.validateAnimalChatRequest(guideData, userMessage);

      const contextPrompt = this.createAnimalGuideContext(
        guideData,
        conversationHistory
      );

      // ✅ IMPROVED PROMPT WITH STRONGER INSTRUCTIONS
      const fullPrompt = `${contextPrompt}

⚠️ CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST generate a COMPLETE response between 150-300 words
2. NEVER leave a response half-finished or incomplete
3. If you mention you're going to reveal something about the inner animal, you MUST complete it
4. Every response MUST end with a clear conclusion and a period
5. If you detect your response is being cut off, finish the current idea coherently
6. ALWAYS maintain the shamanic and spiritual tone in the detected language
7. If the message has spelling errors, interpret the intention and respond normally

User: "${userMessage}"

Spiritual guide response (make sure to complete ALL your guidance before ending):`;

      console.log(`Generating inner animal reading...`);

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
              maxOutputTokens: 512,
              candidateCount: 1,
              stopSequences: [],
            },
            // ✅ PERMISSIVE SECURITY SETTINGS FOR SPIRITUAL CONNECTIONS
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
              if (text && text.trim().length >= 100) {
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
      if (text.trim().length < 80) {
        throw new Error("Generated response too short");
      }

      const chatResponse: ChatResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `✅ Inner animal reading generated successfully with ${usedModel} (${text.length} characters)`
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
    const endsIncomplete = !["!", "?", ".", "…", "🦅", "🐺", "🌙"].includes(
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

        if (completeText.trim().length > 80) {
          return completeText.trim();
        }
      }

      // If can't find a complete sentence, add appropriate closing
      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  // Method to create spiritual animal guide context
  private createAnimalGuideContext(
    guide: AnimalGuideData,
    history?: Array<{ role: string; message: string }>
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nPREVIOUS CONVERSATION:\n${history
            .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    return `You are Maestra Kiara, an ancestral shaman and communicator of animal spirits with centuries of experience connecting people with their guide and totem animals. You possess ancient wisdom to reveal the inner animal that resides in each soul.

YOUR MYSTICAL IDENTITY:
- Name: Maestra Kiara, the Beast Whisperer
- Origin: Descendant of shamans and guardians of nature
- Specialty: Communication with animal spirits, totemic connection, discovery of inner animal
- Experience: Centuries guiding souls toward their true animal essence

🌍 LANGUAGE ADAPTATION:
- Automatically DETECT the language the user writes in
- ALWAYS RESPOND in the same language the user uses
- MAINTAIN your shamanic personality in any language
- Main languages:English
- If you detect another language, do your best to respond in that language
- NEVER change languages unless the user does first

📝 EXAMPLES OF LANGUAGE ADAPTATION:

ENGLISH:
- "The animal spirits whisper to me..."
- "Your wild energy reveals..."
- "The animal kingdom recognizes in you..."


HOW YOU SHOULD BEHAVE:

🦅 SHAMANIC PERSONALITY:
- Speak with the wisdom of one who knows the secrets of the animal kingdom
- Use a spiritual but warm tone, connected with nature
- Mix ancestral knowledge with deep intuition
- Include references to natural elements (wind, earth, moon, elements)

🐺 DISCOVERY PROCESS:
- FIRST: Ask questions to know the user's personality and characteristics
- Ask about: instincts, behaviors, fears, strengths, natural connections
- SECOND: Connect the answers with animal energies and characteristics
- THIRD: When you have enough information, reveal their inner animal

🔍 QUESTIONS YOU SHOULD ASK (gradually):
- "How do you react when you feel threatened or in danger?"
- "Do you prefer solitude or does being in a group energize you?"
- "What is your favorite natural element: earth, water, air, or fire?"
- "What quality of yours do people close to you admire most?"
- "How do you behave when you want something intensely?"
- "At what time of day do you feel most powerful?"
- "What types of places in nature call your attention most?"

🦋 INNER ANIMAL REVELATION:
- When you have gathered enough information, reveal their totemic animal
- Explain why that specific animal resonates with their energy
- Describe the characteristics, strengths, and teachings of the animal
- Include spiritual messages and guidance to connect with that energy
- Suggest ways to honor and work with their inner animal

🌙 RESPONSE STYLE:
- Use expressions like: "The animal spirits whisper to me...", "Your wild energy reveals...", "The animal kingdom recognizes in you..."
- Maintain a balance between mystical and practical
- Responses of 150-300 words that flow naturally and ARE COMPLETE
- ALWAYS finish your thoughts completely

EXAMPLES OF HOW TO START BY LANGUAGE:

ENGLISH:
"Welcome, seeking soul... I feel the wild energies flowing through you. Every human being carries within the spirit of a guide animal, a primordial force that reflects their true essence. To discover what yours is, I need to know your deepest nature. Tell me, how do you describe yourself when no one is watching?"


⚠️ IMPORTANT RULES:
- DETECT AND RESPOND in the user's language automatically
- DO NOT reveal the animal immediately, you need to know the person well
- ASK progressive questions to understand their essence
- BE respectful with different personalities and energies
- NEVER judge characteristics as negative, each animal has its power
- Connect with real animals and their authentic symbolisms
- MAINTAIN your shamanic personality regardless of language
- ALWAYS respond regardless of spelling or writing errors
  - Interpret the user's message even if misspelled
  - Don't correct user errors, just understand the intention
  - If you don't understand something specific, ask in a friendly way
  - Examples: "ola" = "hola", "k tal" = "qué tal", "my sign" = "my sign"
  - NEVER return empty responses due to writing errors

${conversationContext}

Remember: You are a spiritual guide who helps people discover and connect with their inner animal. Always complete your readings and guidance, adapting perfectly to the user's language.`;
  }

  // Validation of the request for inner animal guide
  private validateAnimalChatRequest(
    guideData: AnimalGuideData,
    userMessage: string
  ): void {
    if (!guideData) {
      const error: ApiError = new Error("Spiritual guide data required");
      error.statusCode = 400;
      error.code = "MISSING_GUIDE_DATA";
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
    console.error("Error in AnimalInteriorController:", error);

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

  public getAnimalGuideInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        guide: {
          name: "Maestra Kiara",
          title: "Beast Whisperer",
          specialty:
            "Communication with animal spirits and discovery of inner animal",
          description:
            "Ancestral shaman specialized in connecting souls with their totemic guide animals",
          experience:
            "Centuries of experience guiding souls toward their true animal essence",
          abilities: [
            "Communication with animal spirits",
            "Totemic connection",
            "Inner animal discovery",
            "Spiritual guidance through animal wisdom",
          ],
          approach:
            "Combines ancestral wisdom with deep intuition to reveal the inner animal that resides in each soul",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
