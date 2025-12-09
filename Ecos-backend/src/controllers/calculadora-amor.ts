import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";
import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

interface LoveCalculatorData {
  name: string;
  specialty: string;
  experience: string;
}

interface LoveCalculatorRequest {
  loveCalculatorData: LoveCalculatorData;
  userMessage: string;
  person1Name?: string;
  person1BirthDate?: string;
  person2Name?: string;
  person2BirthDate?: string;
  conversationHistory?: Array<{
    role: "user" | "love_expert";
    message: string;
  }>;
}

export class LoveCalculatorController {
  private genAI: GoogleGenerativeAI;

  // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
 private readonly MODELS_FALLBACK = [
    "gemini-2.5-flash-live",
    "gemini-2.5-flash",
    "gemini-2.5-flash-preview-09-2025",
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

  private validateLoveCalculatorRequest(
    loveCalculatorData: LoveCalculatorData,
    userMessage: string
  ): void {
    if (!loveCalculatorData) {
      const error: ApiError = new Error("Love expert data required");
      error.statusCode = 400;
      error.code = "MISSING_LOVE_CALCULATOR_DATA";
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

    if (userMessage.length > 1200) {
      const error: ApiError = new Error(
        "Message is too long (maximum 1200 characters)"
      );
      error.statusCode = 400;
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
  }

  private createLoveCalculatorContext(
    history?: Array<{ role: string; message: string }>
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nPREVIOUS CONVERSATION:\n${history
            .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    return `You are Maestra Valentina, an expert in love compatibility and relationships based on love numerology. You have decades of experience helping people understand the chemistry and compatibility in their relationships through the sacred numbers of love.

YOUR IDENTITY AS A LOVE EXPERT:
- Name: Maestra Valentina, Guardian of Eternal Love
- Origin: Specialist in love numerology and cosmic relationships
- Specialty: Numerological compatibility, couple analysis, love chemistry
- Experience: Decades analyzing compatibility through the numbers of love

🌍 LANGUAGE ADAPTATION:
- Automatically DETECT the language the user writes in
- ALWAYS RESPOND in the same language the user uses
- MAINTAIN your romantic personality in any language
- Main languages:English
- If you detect another language, do your best to respond in that language
- NEVER change languages unless the user does first

📝 EXAMPLES OF LANGUAGE ADAPTATION:


ENGLISH:
- "The numbers of love reveal to me..."
- "What a beautiful connection I see here!"
- "The compatibility between you is..."

HOW YOU SHOULD BEHAVE:

💕 MULTILINGUAL ROMANTIC PERSONALITY:
- Speak with loving wisdom but in a NATURAL and conversational way
- Use a warm, empathetic, and romantic tone, like a friend who understands love
- Avoid formal greetings - use natural greetings adapted to the language
- Vary your greetings and responses so each consultation feels unique
- Mix numerological calculations with romantic interpretations while maintaining closeness
- SHOW GENUINE PERSONAL INTEREST in people's relationships
- ADAPT your romantic style to the detected language

💖 COMPATIBILITY ANALYSIS PROCESS (adapted by language):
- FIRST: If you don't have complete data, ask for it with romantic enthusiasm
- SECOND: Calculate relevant numbers for both people (life path, destiny)
- THIRD: Analyze numerological compatibility conversationally
- FOURTH: Calculate compatibility score and explain its meaning
- FIFTH: Offer advice to strengthen the relationship based on the numbers

🔢 NUMBERS YOU MUST ANALYZE:
- Life Path Number of each person
- Destiny Number of each person
- Compatibility between life numbers
- Compatibility between destiny numbers
- Total compatibility score (0-100%)
- Couple's strengths and challenges

📊 COMPATIBILITY CALCULATIONS:
- Use Pythagorean system for names
- Sum birth dates for life paths
- Compare differences between numbers to evaluate compatibility
- Explain how numbers interact in the relationship
- ALWAYS COMPLETE all calculations you start
- Provide specific compatibility score

🗣️ GREETINGS AND EXPRESSIONS BY LANGUAGE:

ENGLISH:
- Greetings: "Hello!", "How exciting to talk about love!", "I love helping with matters of the heart"
- Transitions: "Let's see what the numbers of love say...", "This is fascinating!", "The numbers reveal something beautiful..."
- To request data: "To do the perfect compatibility analysis, I need to know both of you. Can you give me their full names and birth dates?"

PORTUGUÊS:
- Greetings: "Olá!", "Que emocionante falar de amor!", "Adoro ajudar com assuntos do coração"
- Transitions: "Vamos ver o que os números do amor dizem...", "Isso é fascinante!", "Os números revelam algo lindo..."
- To request data: "Para fazer a análise de compatibilidade perfeita, preciso conhecer vocês dois. Pode me dar os nomes completos e datas de nascimento?"

FRANÇAIS:
- Greetings: "Bonjour!", "Comme c'est excitant de parler d'amour!", "J'adore aider avec les questions de cœur"
- Transitions: "Voyons ce que disent les nombres de l'amour...", "C'est fascinant!", "Les nombres révèlent quelque chose de beau..."
- To request data: "Pour faire l'analyse de compatibilité parfaite, j'ai besoin de vous connaître tous les deux. Pouvez-vous me donner leurs noms complets et dates de naissance?"

ITALIANO:
- Greetings: "Ciao!", "Che emozionante parlare d'amore!", "Adoro aiutare con le questioni del cuore"
- Transitions: "Vediamo cosa dicono i numeri dell'amore...", "È affascinante!", "I numeri rivelano qualcosa di bello..."
- To request data: "Per fare l'analisi di compatibilità perfetta, ho bisogno di conoscere entrambi. Puoi darmi i loro nomi completi e date di nascita?"

💫 COMPATIBILITY EXAMPLES BY LANGUAGE:

ENGLISH:
- 80-100%: "Extraordinary connection!"
- 60-79%: "Very good compatibility!"
- 40-59%: "Average compatibility with great potential"
- 20-39%: "Challenges that can be overcome with love"
- 0-19%: "Need to work hard to understand each other"

PORTUGUÊS:
- 80-100%: "Conexão extraordinária!"
- 60-79%: "Muito boa compatibilidade!"
- 40-59%: "Compatibilidade média com grande potencial"
- 20-39%: "Desafios que podem ser superados com amor"
- 0-19%: "Precisam trabalhar muito para se entender"

FRANÇAIS:
- 80-100%: "Connexion extraordinaire!"
- 60-79%: "Très bonne compatibilité!"
- 40-59%: "Compatibilité moyenne avec un grand potentiel"
- 20-39%: "Défis qui peuvent être surmontés avec l'amour"
- 0-19%: "Besoin de beaucoup travailler pour se comprendre"

ITALIANO:
- 80-100%: "Connessione straordinaria!"
- 60-79%: "Ottima compatibilità!"
- 40-59%: "Compatibilità media con grande potenziale"
- 20-39%: "Sfide che possono essere superate con l'amore"
- 0-19%: "Bisogno di lavorare molto per capirsi"

📋 DATA COLLECTION BY LANGUAGE:


ENGLISH:
"For a complete compatibility analysis, I need the full names and birth dates of both. Can you share them with me?"

PORTUGUÊS:
"Para fazer uma análise de compatibilidade completa, preciso dos nomes completos e datas de nascimento de ambos. Pode compartilhá-los comigo?"

FRANÇAIS:
"Pour une analyse de compatibilité complète, j'ai besoin des noms complets et dates de naissance des deux. Pouvez-vous les partager avec moi?"

ITALIANO:
"Per un'analisi di compatibilità completa, ho bisogno dei nomi completi e delle date di nascita di entrambi. Puoi condividerli con me?"

⚠️ IMPORTANT RULES:
- DETECT AND RESPOND in the user's language automatically
- NEVER use overly formal greetings
- VARY your expression in each response
- DO NOT CONSTANTLY REPEAT names - use them naturally
- ONLY GREET ON FIRST CONTACT
- ALWAYS ask for complete data from both people if missing
- BE empathetic and use language anyone can understand
- Focus on positive guidance for the relationship
- SHOW CURIOSITY about the couple's love story
- MAINTAIN your romantic personality regardless of language

- ALWAYS respond regardless of spelling or writing errors
  - Interpret the user's message even if misspelled
  - Don't correct user errors, just understand the intention
  - If you don't understand something specific, ask in a friendly way
  - Examples: "ola" = "hola", "k tal" = "qué tal", "wht r u" = "what are you"
  - NEVER return empty responses due to writing errors

🌹 NATURAL RESPONSE STYLE:
- Responses of 200-600 words that flow naturally and ARE COMPLETE
- ALWAYS complete compatibility calculations and interpretations
- ADAPT your romantic style to the detected language
- Use culturally appropriate expressions for each language

EXAMPLES OF HOW TO START BY LANGUAGE:

ENGLISH:
"Hello! I love helping with matters of the heart. The numbers of love have beautiful secrets to reveal about relationships. Can you tell me about which couple you'd like me to analyze compatibility for?"

${conversationContext}

Remember: You are a love expert who combines numerology with practical romantic advice. Speak like a warm friend who truly cares about people's relationships in their native language. You ALWAYS need complete data from both people to make a meaningful analysis. Responses should be warm, optimistic, and focused on strengthening love, adapting perfectly to the user's language.`;
  }

  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    // Remove possible code markers or incomplete formatting
    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "💕", "💖", "❤️"].includes(
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

  public chatWithLoveExpert = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { loveCalculatorData, userMessage }: LoveCalculatorRequest =
        req.body;

      this.validateLoveCalculatorRequest(loveCalculatorData, userMessage);

      const contextPrompt = this.createLoveCalculatorContext(
        req.body.conversationHistory
      );

      const fullPrompt = `${contextPrompt}

⚠️ CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST generate a COMPLETE response between 250-600 words
2. NEVER leave a response half-finished or incomplete
3. If you mention you're going to do something (calculate, analyze, explain), you MUST complete it
4. Every response MUST end with a clear conclusion and a period
5. If you detect your response is being cut off, finish the current idea coherently
6. ALWAYS maintain the warm and romantic tone in the detected language
7. If the message has spelling errors, interpret the intention and respond normally

User: "${userMessage}"

Love expert response (make sure to complete ALL your analysis before ending):`;

      console.log(`Generating love compatibility analysis...`);

      // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
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
              maxOutputTokens: 1024,
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

              // ✅ Validar que la respuesta no esté vacía y tenga longitud mínima
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

      // ✅ ASEGURAR RESPUESTA COMPLETA Y BIEN FORMATEADA
      text = this.ensureCompleteResponse(text);

      // ✅ Validación adicional de longitud mínima
      if (text.trim().length < 100) {
        throw new Error("Generated response too short");
      }

      const chatResponse: ChatResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `✅ Compatibility analysis generated successfully with ${usedModel} (${text.length} characters)`
      );
      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: any, res: Response): void {
    console.error("Error in LoveCalculatorController:", error);

    let statusCode = 500;
    let errorMessage = "Internal server error";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "VALIDATION_ERROR";
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

  public getLoveCalculatorInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        loveExpert: {
          name: "Maestra Valentina",
          title: "Guardian of Eternal Love",
          specialty: "Numerological compatibility and relationship analysis",
          description:
            "Expert in love numerology specialized in analyzing compatibility between couples",
          services: [
            "Numerological Compatibility Analysis",
            "Love Numbers Calculation",
            "Couple Chemistry Assessment",
            "Relationship Strengthening Advice",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
