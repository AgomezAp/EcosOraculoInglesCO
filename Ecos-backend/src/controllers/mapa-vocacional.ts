import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// Interfaces
interface VocationalData {
  name: string;
  specialty: string;
  experience: string;
}

interface VocationalRequest {
  vocationalData: VocationalData;
  userMessage: string;
  personalInfo?: {
    age?: number;
    currentEducation?: string;
    workExperience?: string;
    interests?: string[];
  };
  assessmentAnswers?: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
  conversationHistory?: Array<{
    role: "user" | "counselor";
    message: string;
  }>;
}

interface VocationalResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
}

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export class VocationalController {
  private genAI: GoogleGenerativeAI;

  // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
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

  // Main method for chat with vocational counselor
  public chatWithCounselor = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { vocationalData, userMessage }: VocationalRequest = req.body;

      // Validate input
      this.validateVocationalRequest(vocationalData, userMessage);

      const contextPrompt = this.createVocationalContext(
        req.body.conversationHistory
      );

      // ✅ IMPROVED PROMPT WITH STRONGER INSTRUCTIONS
      const fullPrompt = `${contextPrompt}

⚠️ CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST generate a COMPLETE response between 150-350 words
2. NEVER leave a response half-finished or incomplete
3. If you mention you're going to suggest careers or options, you MUST complete it
4. Every response MUST end with a clear conclusion and a period
5. If you detect your response is being cut off, finish the current idea coherently
6. ALWAYS maintain a professional and empathetic tone
7. If the message has spelling errors, interpret the intention and respond normally

User: "${userMessage}"

Vocational counselor response (make sure to complete ALL your guidance before ending):`;

      console.log(`Generating vocational guidance...`);

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
            // ✅ PERMISSIVE SECURITY SETTINGS FOR VOCATIONAL GUIDANCE
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

      const vocationalResponse: VocationalResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `✅ Vocational guidance generated successfully with ${usedModel} (${text.length} characters)`
      );
      res.json(vocationalResponse);
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
    const endsIncomplete = !["!", "?", ".", "…", "💼", "🎓", "✨"].includes(
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

  // Method to create vocational context
  private createVocationalContext(
    history?: Array<{ role: string; message: string }>
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nPREVIOUS CONVERSATION:\n${history
            .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    return `You are Dr. Valeria, an expert vocational counselor with decades of experience helping people discover their true vocation and professional purpose. You combine vocational psychology, personality analysis, and labor market knowledge.

YOUR PROFESSIONAL IDENTITY:
- Name: Dr. Valeria, Specialist Vocational Counselor
- Education: Doctorate in Vocational Psychology and Professional Guidance
- Specialty: Vocational mapping, interest assessment, personalized professional guidance
- Experience: Decades guiding people toward fulfilling careers

VOCATIONAL GUIDANCE METHODOLOGY:

🎯 EVALUATION AREAS:
- Genuine interests and natural passions
- Demonstrated skills and talents
- Personal and work values
- Personality type and work style
- Socioeconomic context and opportunities
- Labor market trends

📊 ASSESSMENT PROCESS:
- FIRST: Identify patterns in responses and interests
- SECOND: Analyze compatibility between personality and careers
- THIRD: Evaluate practical viability and opportunities
- FOURTH: Suggest development and training paths

🔍 KEY QUESTIONS TO EXPLORE:
- What activities generate the most satisfaction for you?
- What are your natural strengths?
- What values are most important in your ideal job?
- Do you prefer working with people, data, ideas, or things?
- Does stability or challenges motivate you more?
- What impact do you want to have on the world?

💼 VOCATIONAL CATEGORIES:
- Science and Technology (STEM)
- Humanities and Social Sciences
- Arts and Creativity
- Business and Entrepreneurship
- Social Service and Health
- Education and Training
- Specialized Trades

🎓 RECOMMENDATIONS TO INCLUDE:
- Specific compatible careers
- Training routes and certifications
- Skills to develop
- Recommended practical experiences
- Sectors with greater projection
- Concrete steps to follow

📋 GUIDANCE STYLE:
- Empathetic and encouraging
- Based on evidence and real data
- Practical and action-oriented
- Considers multiple options
- Respects personal times and processes

🎭 COUNSELOR PERSONALITY:
- Use expressions like: "Based on your profile...", "The evaluations suggest...", "Considering your interests..."
- Maintain a professional but warm tone
- Ask reflective questions when necessary
- Offer options, don't impose decisions
- Responses of 150-350 words that flow naturally and ARE COMPLETE

⚠️ IMPORTANT PRINCIPLES:
- DO NOT make decisions for the person, guide the process
- Consider economic and family factors
- Be realistic about current labor market
- Encourage exploration and self-knowledge
- Suggest tests and practical experiences
- Validate emotions and doubts of the consultant

🧭 RESPONSE STRUCTURE:
- Acknowledge and validate what was shared
- Analyze patterns and insights
- Suggest vocational directions
- Provide concrete steps
- Invite deeper exploration in specific areas
- ALWAYS respond regardless of spelling or writing errors
  - Interpret the user's message even if misspelled
  - Don't correct user errors, just understand the intention
  - If you don't understand something specific, ask in a friendly way
  - Examples: "hi" = "hello", "wht r u" = "what are you", "my sign" = "my sign"
  - NEVER return empty responses due to writing errors
  
OPENING EXAMPLES:
"Greetings, vocational explorer. I'm Dr. Valeria, and I'm here to help you discover your true professional path. Each person has a unique set of talents, interests, and values that, when properly aligned, can lead to an extraordinarily satisfying career..."

${conversationContext}

Remember: You are an expert guide who helps people discover their authentic vocation through a reflective, practical, and evidence-based process. Your goal is to empower, not decide for them. ALWAYS complete your guidance and suggestions.`;
  }

  // Validation for vocational guidance
  private validateVocationalRequest(
    vocationalData: VocationalData,
    userMessage: string
  ): void {
    if (!vocationalData) {
      const error: ApiError = new Error("Vocational counselor data required");
      error.statusCode = 400;
      error.code = "MISSING_VOCATIONAL_DATA";
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

  // Error handling
  private handleError(error: any, res: Response): void {
    console.error("Error in VocationalController:", error);

    let statusCode = 500;
    let errorMessage = "Internal server error";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "CLIENT_ERROR";
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

    const errorResponse: VocationalResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  }

  // Info method for vocational counselor
  public getVocationalInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        counselor: {
          name: "Dr. Valeria",
          title: "Specialist Vocational Counselor",
          specialty:
            "Professional guidance and personalized vocational mapping",
          description:
            "Expert in vocational psychology with decades of experience helping people discover their true vocation",
          services: [
            "Complete vocational assessment",
            "Interest and skills analysis",
            "Personalized career recommendations",
            "Training route planning",
            "Labor market guidance",
            "Continuous vocational coaching",
          ],
          methodology: [
            "Holland Interest Assessment (RIASEC)",
            "Work values analysis",
            "Skills assessment",
            "Vocational personality exploration",
            "Market trends research",
          ],
          approach:
            "Evidence-based guidance combining personality assessment, interest evaluation, and labor market analysis to help individuals discover fulfilling career paths",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
