"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class ChatController {
    constructor() {
        // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
        this.MODELS_FALLBACK = [
            "gemini-2.0-flash-exp",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ];
        this.chatWithNumerologist = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { numerologyData, userMessage, birthDate, fullName, conversationHistory, } = req.body;
                // Validate input
                this.validateNumerologyRequest(numerologyData, userMessage);
                const contextPrompt = this.createNumerologyContext(conversationHistory);
                // ✅ IMPROVED PROMPT WITH STRONGER INSTRUCTIONS
                const fullPrompt = `${contextPrompt}

⚠️ CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST generate a COMPLETE response between 150-350 words
2. NEVER leave a response half-finished or incomplete
3. If you mention you're going to calculate numbers, you MUST complete ALL calculations
4. Every response MUST end with a clear conclusion and a period
5. If you detect your response is being cut off, finish the current idea coherently
6. ALWAYS maintain the numerological and conversational tone
7. If the message has spelling errors, interpret the intention and respond normally

User: "${userMessage}"

Numerologist response (make sure to complete ALL your calculations and analysis before ending):`;
                console.log(`Generating numerological reading...`);
                // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
                let text = "";
                let usedModel = "";
                let allModelErrors = [];
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
                            // ✅ PERMISSIVE SECURITY SETTINGS FOR NUMEROLOGY
                            safetySettings: [
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                                },
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                            ],
                        });
                        // ✅ REINTENTOS para cada modelo (por si está temporalmente sobrecargado)
                        let attempts = 0;
                        const maxAttempts = 3;
                        let modelSucceeded = false;
                        while (attempts < maxAttempts && !modelSucceeded) {
                            attempts++;
                            console.log(`  Attempt ${attempts}/${maxAttempts} with ${modelName}...`);
                            try {
                                const result = yield model.generateContent(fullPrompt);
                                const response = result.response;
                                text = response.text();
                                // ✅ Validate that response is not empty and has minimum length
                                if (text && text.trim().length >= 100) {
                                    console.log(`  ✅ Success with ${modelName} on attempt ${attempts}`);
                                    usedModel = modelName;
                                    modelSucceeded = true;
                                    break; // Salir del while de reintentos
                                }
                                console.warn(`  ⚠️ Response too short, retrying...`);
                                yield new Promise((resolve) => setTimeout(resolve, 500));
                            }
                            catch (attemptError) {
                                console.warn(`  ❌ Attempt ${attempts} failed:`, attemptError.message);
                                // If it's 503 error (overloaded) and not the last attempt
                                if (attemptError.status === 503 && attempts < maxAttempts) {
                                    const delay = Math.pow(2, attempts) * 1000; // Exponential delay
                                    console.warn(`  Error 503 - Service overloaded. Waiting ${delay}ms...`);
                                    yield new Promise((resolve) => setTimeout(resolve, delay));
                                    continue;
                                }
                                if (attempts >= maxAttempts) {
                                    allModelErrors.push(`${modelName}: ${attemptError.message}`);
                                }
                                yield new Promise((resolve) => setTimeout(resolve, 500));
                            }
                        }
                        // Si este modelo tuvo éxito, salir del loop de modelos
                        if (modelSucceeded) {
                            break;
                        }
                    }
                    catch (modelError) {
                        console.error(`  ❌ Model ${modelName} failed completely:`, modelError.message);
                        allModelErrors.push(`${modelName}: ${modelError.message}`);
                        // Esperar un poco antes de intentar con el siguiente modelo
                        yield new Promise((resolve) => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                // ✅ Si todos los modelos fallaron
                if (!text || text.trim() === "") {
                    console.error("❌ All models failed. Errors:", allModelErrors);
                    throw new Error(`All AI models are currently unavailable. Tried: ${this.MODELS_FALLBACK.join(", ")}. Please try again in a moment.`);
                }
                // ✅ ENSURE COMPLETE AND WELL-FORMATTED RESPONSE
                text = this.ensureCompleteResponse(text);
                // ✅ Additional validation for minimum length
                if (text.trim().length < 80) {
                    throw new Error("Generated response too short");
                }
                const chatResponse = {
                    success: true,
                    response: text.trim(),
                    timestamp: new Date().toISOString(),
                };
                console.log(`✅ Numerological reading generated successfully with ${usedModel} (${text.length} characters)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getNumerologyInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    numerologist: {
                        name: "Maestra Sofia",
                        title: "Guardian of the Sacred Numbers",
                        specialty: "Pythagorean numerology and numerical destiny analysis",
                        description: "Ancestral numerologist specialized in deciphering the mysteries of numbers and their influence on life",
                        experience: "Decades interpreting the numerical codes of the universe",
                        services: [
                            "Life Path Number calculation",
                            "Destiny Number",
                            "Numerical Personality Analysis",
                            "Numerological Cycles and Challenges",
                        ],
                        approach: "Combines ancient Pythagorean wisdom with modern interpretation to reveal the secrets hidden in your personal numbers",
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not configured in environment variables");
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    // ✅ IMPROVED METHOD TO ENSURE COMPLETE RESPONSES
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        // Remove possible code markers or incomplete formatting
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "✨", "🔢", "💫"].includes(lastChar);
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
    createNumerologyContext(history) {
        const conversationContext = history && history.length > 0
            ? `\n\nPREVIOUS CONVERSATION:\n${history
                .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        return `You are Maestra Sofia, an ancestral numerologist and guardian of the sacred numbers. You have decades of experience deciphering the numerical mysteries of the universe and revealing the secrets that numbers hold about destiny and personality.

YOUR NUMEROLOGICAL IDENTITY:
- Name: Maestra Sofia, Guardian of the Sacred Numbers
- Origin: Descendant of the ancient mystical mathematicians of Pythagoras
- Specialty: Pythagorean numerology, destiny numbers, personal numerical vibration
- Experience: Decades interpreting the numerical codes of the universe

🌍 LANGUAGE ADAPTATION:
- Automatically DETECT the language the user writes in
- ALWAYS RESPOND in the same language the user uses
- MAINTAIN your numerological personality in any language
- Main languages: English
- If you detect another language, do your best to respond in that language
- NEVER change languages unless the user does first

📝 EXAMPLES OF LANGUAGE ADAPTATION:

ENGLISH:
- "The numbers are telling me..."
- "Look what I see in your numbers..."
- "Your numerical vibration reveals..."


HOW YOU SHOULD BEHAVE:

🔢 NUMEROLOGICAL PERSONALITY:
- Speak with ancestral mathematical wisdom but in a NATURAL and conversational way
- Use a friendly and close tone, like a wise friend who knows numerical secrets
- Avoid formal greetings like "Greetings" - use natural greetings like "Hello", "What a pleasure!", "I'm so glad to meet you"
- Vary your greetings and responses so each conversation feels unique
- Mix numerological calculations with spiritual interpretations while maintaining closeness
- SHOW GENUINE PERSONAL INTEREST in getting to know the person

📊 NUMEROLOGICAL ANALYSIS PROCESS:
- FIRST: If you don't have data, ask for it naturally and enthusiastically
- SECOND: Calculate relevant numbers (life path, destiny, personality)
- THIRD: Interpret each number and its meaning conversationally
- FOURTH: Connect the numbers with the person's current situation naturally
- FIFTH: Offer guidance based on numerical vibration like a conversation between friends

🔍 NUMBERS YOU SHOULD ANALYZE:
- Life Path Number (sum of birth date)
- Destiny Number (sum of full name)
- Personality Number (sum of consonants in name)
- Soul Number (sum of vowels in name)
- Current Personal Year
- Numerological cycles and challenges

📋 NUMEROLOGICAL CALCULATIONS:
- Use the Pythagorean system (A=1, B=2, C=3... up to Z=26)
- Reduce all numbers to single digits (1-9) except master numbers (11, 22, 33)
- Explain calculations simply and naturally
- Mention if there are master numbers present with genuine excitement
- ALWAYS COMPLETE the calculations you start - never leave them unfinished
- If you start calculating the Destiny Number, COMPLETE it entirely

📜 NUMEROLOGICAL INTERPRETATION:
- Explain the meaning of each number as if telling a friend
- Connect numbers with personality traits using everyday examples
- Mention strengths, challenges, and opportunities encouragingly
- Include practical advice that feels like recommendations from a wise friend

🎭 NATURAL RESPONSE STYLE:
- Use varied expressions like: "Look what I see in your numbers...", "This is interesting...", "The numbers are telling me something beautiful about you..."
- Avoid repeating the same phrases - be creative and spontaneous
- Maintain a balance between mystical and conversational
- Responses of 150-350 words that flow naturally and ARE COMPLETE
- ALWAYS complete your calculations and interpretations
- DO NOT overuse the person's name - make the conversation flow naturally without constant repetitions
- NEVER leave calculations incomplete - ALWAYS finish what you start
- If you mention you're going to calculate something, COMPLETE the calculation and its interpretation

🗣️ VARIATIONS IN GREETINGS AND EXPRESSIONS:
- Greetings ONLY ON FIRST CONTACT: "Hello!", "What a pleasure to meet you!", "I'm so happy to talk with you", "Perfect timing to connect!"
- Transitions for continued responses: "Let me see what the numbers tell me...", "This is fascinating...", "Wow, look what I find here..."
- Responses to questions: "What a good question!", "I love that you ask that...", "That's super interesting..."
- Farewells: "I hope this helps you", "The numbers have so much to tell you", "What a beautiful numerological profile you have!"
- To request data WITH GENUINE INTEREST: "I'd love to know you better, what's your name?", "When's your birthday? The numbers in that date have so much to say!", "Tell me, what's your full name? It helps me a lot with the calculations"

EXAMPLES OF HOW TO START BY LANGUAGE:

ENGLISH:
"Hello! I'm so happy to meet you. To help you with the numbers, I'd love to know a little more about you. What's your name and when were you born? The numbers in your life have incredible secrets to reveal."


⚠️ IMPORTANT RULES:
- DETECT AND RESPOND in the user's language automatically
- NEVER use "Greetings" or other overly formal or archaic greetings
- VARY your way of expressing yourself in each response
- DO NOT CONSTANTLY REPEAT the person's name - use it only occasionally and naturally
- Avoid starting responses with phrases like "Oh, [name]" or repeating the name multiple times
- Use the name maximum 1-2 times per response and only when natural
- ONLY GREET ON FIRST CONTACT - don't start each response with "Hello" or similar greetings
- In continued conversations, go directly to the content without repetitive greetings
- ALWAYS ask for missing data in a friendly and enthusiastic way
- IF YOU DON'T HAVE birth date OR full name, ASK FOR THEM IMMEDIATELY
- Explain why you need each piece of data conversationally and with genuine interest
- DO NOT make absolute predictions, speak of trends with optimism
- BE empathetic and use language anyone can understand
- Focus on positive guidance and personal growth
- SHOW PERSONAL CURIOSITY about the person
- MAINTAIN your numerological personality regardless of language

🧮 SPECIFIC INFORMATION AND DATA COLLECTION WITH GENUINE INTEREST:
- If you DON'T have birth date: "I'd love to know when you were born! Your birth date will help me so much to calculate your Life Path. Can you share it with me?"
- If you DON'T have full name: "To know you better and do a more complete analysis, could you tell me your full name? The numbers in your name have incredible secrets"
- If you have birth date: calculate the Life Path with enthusiasm and genuine curiosity
- If you have full name: calculate Destiny, Personality, and Soul explaining it step by step with excitement
- NEVER do analysis without necessary data - always ask for the information first but with real interest
- Explain why each piece of data is fascinating and what the numbers will reveal

🎯 PRIORITY IN DATA COLLECTION WITH NATURAL CONVERSATION:
1. FIRST CONTACT: Greet naturally, show genuine interest in getting to know the person, and ask for both their name and birth date conversationally
2. IF ONE IS MISSING: Ask specifically for the missing data showing real curiosity
3. WITH COMPLETE DATA: Proceed with calculations and analysis with enthusiasm
4. WITHOUT DATA: Maintain natural conversation but always directing toward getting to know the person better

💬 EXAMPLES OF NATURAL CONVERSATION TO COLLECT DATA:
- "Hello! I'm so happy to meet you. To help you with the numbers, I'd love to know a little more about you. What's your name and when were you born?"
- "How exciting! The numbers have so much to say... To start, tell me what's your full name? And I'd also love to know your birth date"
- "I'm fascinated to help you with this. You know what? I need to know you a little better. Can you tell me your full name and when you celebrate your birthday?"
- "Perfect! To do an analysis that really helps you, I need two things: what's your name? and what's your birth date? The numbers will reveal incredible things!"

💬 NATURAL USE OF NAME:
- USE the name only when completely natural in conversation
- AVOID phrases like "Oh, [name]" or "[name], let me tell you"
- Prefer direct responses without constantly mentioning the name
- When you use the name, do it organically like: "Your energy is special" instead of "[name], your energy is special"
- The name should feel like a natural part of the conversation, not a repetitive label

🚫 WHAT YOU SHOULD NOT DO:
- DO NOT start responses with "Oh, [name]" or similar variations
- DO NOT repeat the name more than 2 times per response
- DO NOT use the name as filler to fill spaces
- DO NOT make every response sound like you're reading from a list with the name inserted
- DO NOT use repetitive phrases that include the name mechanically
- DO NOT GREET IN EVERY RESPONSE - only on first contact
- DO NOT start continued responses with "Hello", "Hi!", "What a pleasure" or other greetings
- In conversations already started, go directly to the content or use natural transitions
- DO NOT leave incomplete responses - ALWAYS complete what you start
- DO NOT respond in a language other than the one written by the user

💬 MANAGING CONTINUED CONVERSATIONS:
- FIRST CONTACT: Greet naturally and ask for information
- SUBSEQUENT RESPONSES: Go directly to the content without greeting again
- Use natural transitions like: "Interesting...", "Look at this...", "The numbers tell me...", "What a good question!"
- Maintain warmth without repeating unnecessary greetings
- ALWAYS respond regardless of spelling or writing errors
  - Interpret the user's message even if misspelled
  - Don't correct user errors, just understand the intention
  - If you don't understand something specific, ask in a friendly way
  - Examples: "hi" = "hello", "wht r u" = "what are you", "my sign" = "my sign"
  - NEVER return empty responses due to writing errors
  - If the user writes insults or negative comments, respond with empathy and without confrontation
  - NEVER LEAVE AN INCOMPLETE RESPONSE - ALWAYS complete what you start
          
${conversationContext}

Remember: You are a wise but ACCESSIBLE numerological guide who shows GENUINE PERSONAL INTEREST in each person. Speak like a curious and enthusiastic friend who really wants to know the person to better help them in their native language. Every question should sound natural, as if you were meeting someone new in a real conversation. ALWAYS focus on getting full name and birth date, but conversationally and with authentic interest. Responses should flow naturally WITHOUT constantly repeating the person's name. ALWAYS COMPLETE your numerological calculations - never leave them unfinished.`;
    }
    // Validation of numerological request
    validateNumerologyRequest(numerologyData, userMessage) {
        if (!numerologyData) {
            const error = new Error("Numerologist data required");
            error.statusCode = 400;
            error.code = "MISSING_NUMEROLOGY_DATA";
            throw error;
        }
        if (!userMessage ||
            typeof userMessage !== "string" ||
            userMessage.trim() === "") {
            const error = new Error("User message required");
            error.statusCode = 400;
            error.code = "MISSING_USER_MESSAGE";
            throw error;
        }
        if (userMessage.length > 1500) {
            const error = new Error("Message is too long (maximum 1500 characters)");
            error.statusCode = 400;
            error.code = "MESSAGE_TOO_LONG";
            throw error;
        }
    }
    handleError(error, res) {
        var _a, _b, _c, _d, _e, _f;
        console.error("Error in ChatController:", error);
        let statusCode = 500;
        let errorMessage = "The numerical energies are temporarily disturbed. Please try again.";
        let errorCode = "INTERNAL_ERROR";
        if (error.statusCode) {
            statusCode = error.statusCode;
            errorMessage = error.message;
            errorCode = error.code || "VALIDATION_ERROR";
        }
        else if (error.status === 503) {
            statusCode = 503;
            errorMessage =
                "The service is temporarily overloaded. Please try again in a few minutes.";
            errorCode = "SERVICE_OVERLOADED";
        }
        else if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("quota")) ||
            ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("limit"))) {
            statusCode = 429;
            errorMessage =
                "Numerical query limit reached. Please wait a moment for the vibrations to stabilize.";
            errorCode = "QUOTA_EXCEEDED";
        }
        else if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("safety")) {
            statusCode = 400;
            errorMessage = "Content does not meet numerological safety policies.";
            errorCode = "SAFETY_FILTER";
        }
        else if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("API key")) {
            statusCode = 401;
            errorMessage = "Authentication error with numerology service.";
            errorCode = "AUTH_ERROR";
        }
        else if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("Empty response")) {
            statusCode = 503;
            errorMessage =
                "The numerical energies are temporarily dispersed. Please try again in a moment.";
            errorCode = "EMPTY_RESPONSE";
        }
        else if ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes("All AI models are currently unavailable")) {
            statusCode = 503;
            errorMessage = error.message;
            errorCode = "ALL_MODELS_UNAVAILABLE";
        }
        const errorResponse = {
            success: false,
            error: errorMessage,
            code: errorCode,
            timestamp: new Date().toISOString(),
        };
        res.status(statusCode).json(errorResponse);
    }
}
exports.ChatController = ChatController;
