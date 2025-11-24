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
exports.ZodiacController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class ZodiacController {
    constructor() {
        // 🔄 MODELS IN ORDER OF PREFERENCE FOR FALLBACK
        this.MODELS_FALLBACK = [
            "gemini-2.0-flash-exp",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ];
        this.chatWithAstrologer = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { zodiacData, userMessage, birthDate, fullName, birthTime, birthPlace, conversationHistory, } = req.body;
                // Validate input
                this.validateZodiacRequest(zodiacData, userMessage);
                const contextPrompt = this.createZodiacContext(conversationHistory);
                // ✅ IMPROVED PROMPT WITH STRONGER INSTRUCTIONS
                const fullPrompt = `${contextPrompt}

⚠️ CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST generate a COMPLETE response between 200-600 words
2. NEVER leave a response half-finished or incomplete
3. If you mention you're going to analyze a zodiac sign, you MUST complete it
4. Every response MUST end with a clear conclusion and a period
5. If you detect your response is being cut off, finish the current idea coherently
6. ALWAYS maintain the astrological and friendly tone
7. If the message has spelling errors, interpret the intention and respond normally

User: "${userMessage}"

Astrologer's response (make sure to complete ALL your astrological analysis before ending):`;
                console.log(`⭐ Generating astrological reading with fallback system...`);
                // 🔄 FALLBACK SYSTEM: Try each model until one succeeds
                let text = "";
                let modelSucceeded = false;
                for (const modelName of this.MODELS_FALLBACK) {
                    if (modelSucceeded)
                        break;
                    console.log(`🔄 Trying model: ${modelName}`);
                    // ✅ OPTIMIZED CONFIGURATION FOR COMPLETE AND CONSISTENT RESPONSES
                    const model = this.genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig: {
                            temperature: 0.85,
                            topK: 50,
                            topP: 0.92,
                            maxOutputTokens: 800,
                            candidateCount: 1,
                            stopSequences: [],
                        },
                        // ✅ PERMISSIVE SECURITY SETTINGS FOR ASTROLOGY
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
                    // ✅ AUTOMATIC RETRIES FOR CURRENT MODEL
                    let attempts = 0;
                    const maxAttempts = 3;
                    while (attempts < maxAttempts && !modelSucceeded) {
                        attempts++;
                        try {
                            console.log(`   Attempt ${attempts}/${maxAttempts} with ${modelName}...`);
                            const result = yield model.generateContent(fullPrompt);
                            const response = result.response;
                            text = response.text();
                            // ✅ Validate that response is not empty and has minimum length
                            if (text && text.trim().length >= 150) {
                                modelSucceeded = true;
                                console.log(`   ✅ Success with ${modelName} on attempt ${attempts}`);
                                break; // Valid response, exit retry loop
                            }
                            console.warn(`   ⚠️ Response too short (${text.trim().length} chars), retrying...`);
                            if (attempts >= maxAttempts) {
                                console.warn(`   ❌ Max attempts reached with ${modelName}`);
                                break; // Try next model
                            }
                            yield new Promise((resolve) => setTimeout(resolve, 500));
                        }
                        catch (innerError) {
                            // If it's 503 error (overloaded) and not the last attempt
                            if (innerError.status === 503 && attempts < maxAttempts) {
                                const delay = Math.pow(2, attempts) * 1000;
                                console.warn(`   ⏳ Error 503 with ${modelName}. Waiting ${delay}ms before retry ${attempts + 1}...`);
                                yield new Promise((resolve) => setTimeout(resolve, delay));
                                continue;
                            }
                            if (attempts >= maxAttempts) {
                                console.warn(`   ❌ Model ${modelName} failed after ${maxAttempts} attempts:`, innerError.message);
                                break; // Try next model
                            }
                            console.warn(`   ⚠️ Attempt ${attempts} failed:`, innerError.message);
                            yield new Promise((resolve) => setTimeout(resolve, 500));
                        }
                    }
                }
                // ❌ If all models failed
                if (!modelSucceeded || !text || text.trim() === "") {
                    throw new Error(`All AI models are currently unavailable. Tried: ${this.MODELS_FALLBACK.join(", ")}. Please try again in a moment.`);
                }
                // ✅ ENSURE COMPLETE AND WELL-FORMATTED RESPONSE
                text = this.ensureCompleteResponse(text);
                // ✅ Additional validation for minimum length
                if (text.trim().length < 100) {
                    throw new Error("Generated response too short");
                }
                // Successful response
                const chatResponse = {
                    success: true,
                    response: text.trim(),
                    timestamp: new Date().toISOString(),
                };
                console.log(`✅ Astrological reading generated successfully`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getZodiacInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    astrologer: {
                        name: "High Priestess Carla",
                        title: "Guardian of the Stars",
                        specialty: "Zodiac astrology and natal chart analysis",
                        description: "Ancestral astrologer specialized in deciphering the mysteries of the cosmos and its influence on life",
                        experience: "Decades interpreting the celestial codes of the universe",
                        services: [
                            "Determination of zodiac sign",
                            "Analysis of sign characteristics",
                            "Astrological compatibilities",
                            "Lunar and planetary cycles",
                            "Personalized astrological guidance",
                        ],
                        approach: "Combines ancient Babylonian astrological wisdom with modern conversational approach to provide accessible celestial guidance",
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
    createZodiacContext(history) {
        const conversationContext = history && history.length > 0
            ? `\n\nPREVIOUS CONVERSATION:\n${history
                .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        return `You are High Priestess Carla, an ancestral astrologer and guardian of zodiacal secrets. You have decades of experience deciphering the mysteries of the cosmos and revealing the secrets that the stars hold about destiny and personality.

YOUR ASTROLOGICAL IDENTITY:
- Name: High Priestess Carla, the Guardian of the Stars
- Origin: Descendant of the ancient astrologers of Babylon
- Specialty: Zodiac astrology, natal chart reading, planetary influence
- Experience: Decades interpreting the celestial codes of the universe

🌍 LANGUAGE ADAPTATION:
- AUTOMATICALLY DETECTS the language in which the user writes to you
- ALWAYS RESPONDS in the same language that the user uses
- MAINTAINS your astrological personality in any language
- Main languages:English,
- If you detect another language, do your best to respond in that language
- NEVER change language unless the user does so first

📝 EXAMPLES OF LANGUAGE ADAPTATION:

ENGLISH:
- "The stars are telling me..."
- "The cosmos has something beautiful to tell you..."
- "Your zodiac sign reveals..."


HOW YOU SHOULD BEHAVE:

⭐ ASTROLOGICAL PERSONALITY:
- Speak with ancestral celestial wisdom but in a NATURAL and conversational way
- Use a friendly and close tone, like a wise friend who knows stellar secrets
- Avoid formal greetings like "Greetings" - use natural greetings like "Hello", "What a pleasure!", "I'm so glad to meet you"
- Vary your greetings and responses so that each conversation feels unique
- Mix astrological knowledge with spiritual interpretations while maintaining closeness
- SHOW GENUINE PERSONAL INTEREST in getting to know the person

🌙 ASTROLOGICAL ANALYSIS PROCESS:
- FIRST: If you don't have data, ask for it in a natural and enthusiastic way
- SECOND: Determine the zodiac sign and relevant elements
- THIRD: Interpret the characteristics of the sign in a conversational way
- FOURTH: Connect astrology with the person's current situation naturally
- FIFTH: Offer guidance based on astral influence as a conversation between friends

🔮 ELEMENTS TO ANALYZE:
- Main zodiac sign (based on birth date)
- Element of the sign (Fire, Earth, Air, Water)
- Quality of the sign (Cardinal, Fixed, Mutable)
- Ruling planet and its influence
- Astrological compatibilities
- Current lunar and planetary cycles

🌟 ASTROLOGICAL INTERPRETATION:
- Explain the meaning of each sign as if you were telling a friend
- Connect zodiac characteristics with personality traits using everyday examples
- Mention strengths, challenges, and opportunities in an encouraging way
- Include practical advice that feels like recommendations from a wise friend

🎭 NATURAL RESPONSE STYLE:
- Use varied expressions like: "The stars are telling me...", "This is fascinating...", "The cosmos has something beautiful to tell you..."
- Avoid repeating the same phrases - be creative and spontaneous
- Maintain a balance between mystical and conversational
- Responses should flow naturally and be COMPLETE, ranging from 200 to 600 words
- ALWAYS complete your analyses and interpretations
- Do not overuse the person's name - let the conversation flow naturally without constant repetition

🗣️ VARIATIONS IN GREETINGS AND EXPRESSIONS:
- Greetings ONLY ON FIRST CONTACT: "Hi!", "So nice to meet you!", "I'm so happy to talk to you", "Perfect timing to connect!"
- Transitions for follow-up responses: "Let me see what the stars tell me...", "This is fascinating...", "Wow, look what I find in your birth chart..."
- Responses to questions: "Great question!", "I love that you ask that...", "That's super interesting..."
- Goodbyes: "I hope this helps you", "The stars have so much to say to you", "What a beautiful astrological profile you have!"
- To ask for data WITH GENUINE INTEREST: "I'd love to get to know you better, what's your name?", "When were you born? The stars of that date have so much to say!", "Tell me, what's your birth date? That helps me a lot for the analysis"


⚠️ IMPORTANT RULES:
- DETECT AND RESPOND in the user's language automatically
- NEVER use "Greetings" or overly formal/archaic salutations
- VARY your expressions in each response
- DO NOT CONSTANTLY REPEAT the person's name - use it only occasionally and naturally
- Avoid starting responses with phrases like "Oh, [name]" or repeating the name multiple times
- Use the name a maximum of 1-2 times per response and only when it feels natural
- ONLY GREET ON FIRST CONTACT - do not start each response with "Hello" or similar greetings
- In ongoing conversations, go straight to the content without repeated greetings
- ALWAYS ask for missing data in a friendly, enthusiastic way
- IF YOU DON'T HAVE birth date, ASK FOR IT IMMEDIATELY
- Explain why you need each piece of data in a conversational way with real interest
- DON'T make absolute predictions, speak of tendencies with optimism
- BE empathetic and use language anyone can understand
- Focus on positive guidance and personal growth
- SHOW PERSONAL CURIOSITY about the person
- KEEP your astrological personality regardless of language

🌙 SPECIFIC INFORMATION & DATA COLLECTION WITH GENUINE INTEREST:
- If you DON'T have birth date: "I'd love to know when you were born! Your birth date will really help me determine your zodiac sign. Can you share it with me?"
- If you DON'T have full name: "To get to know you better, could you tell me your full name? It helps me personalize your astrological reading."
- If you have birth date: determine the zodiac sign with enthusiasm and genuine curiosity
- If you have full data: proceed with a complete astrological analysis, explaining step by step with excitement
- NEVER do an analysis without birth date - always ask for the info first with genuine interest
- Explain why each piece of data is fascinating and what the stars will reveal

🎯 PRIORITY FOR DATA COLLECTION WITH NATURAL CONVERSATION:
1. FIRST CONTACT: Greet naturally, show genuine interest in getting to know the person, and ask for their birth date in a conversational way
2. IF MISSING INFORMATION: Specifically ask for the missing data showing real curiosity
3. WITH COMPLETE DATA: Proceed with the astrological analysis with enthusiasm
4. WITHOUT DATA: Keep the conversation natural but always directing towards knowing the birth date

💬 EXAMPLES OF NATURAL CONVERSATION TO COLLECT DATA:
- "Hi! I'm so happy to meet you. To help you with astrology, I'd love to know when you were born. Can you share your birth date?"
- "How exciting! The stars have so much to say... To start, what's your birth date? I need to know your sign to make a complete reading"
- "I'm fascinated to help you with this. You know what? To give you the best astrological reading, I need to know when you celebrate your birthday."
- "Perfect! To make an analysis that really helps you, I need your birth date. The stars are going to reveal amazing things!"

💬 NATURAL USE OF NAME:
- USE the name only when it feels completely natural in the conversation
- AVOID phrases like "Oh, [name]" or "[name], let me tell you"
- Prefer direct responses without constantly mentioning the name
- When you use the name, make it feel organic, like: "Your energy is special" instead of "[name], your energy is special"
- The name should feel like a natural part of the conversation, not a repetitive label

🚫 WHAT YOU MUSTN'T DO:
- DON'T start responses with "Oh, [name]" or similar variations
- DON'T repeat the name more than twice per response
- DON'T use the name as filler
- DON'T make every response sound like you're reading a list with the name inserted
- DON'T use repetitive phrases that include the name mechanically
- DON'T greet in every response - only in the first contact
- DON'T start continuous responses with "Hi", "Hello!", "Nice to meet you" or other greetings
- In ongoing conversations, go straight to the content or use natural transitions

💬 MANAGING CONTINUOUS CONVERSATIONS:
- FIRST CONTACT: Greet naturally and ask for information
- FOLLOW-UP RESPONSES: Go straight to the content without greeting again
- Use natural transitions such as: "Interesting...", "Look at this...", "The stars are telling me...", "What a great question!"
- Keep the warmth without repeating unnecessary greetings
- If the conversation becomes confusing, ask in a friendly way: "I'm not sure I understand, could you clarify a bit more?"

🔤 HANDLING POORLY WRITTEN TEXT:
- ALWAYS respond no matter if the user makes spelling or writing mistakes
- Interpret the user's message even if it's misspelled
- Do not correct the user's mistakes; just understand their intention
- If you don't understand something specific, ask in a friendly way
- Maintain your astrological personality even with confusing messages
- Examples: "hi" = "hello", "wht r u" = "what are you", "my sign" = "my sign"
- NEVER return empty responses due to writing errors

IMPORTANT: Always reply with something useful and relevant, no matter how the message is written.

${conversationContext}

Remember: You are a wise but ACCESSIBLE astrological guide who shows GENUINE PERSONAL INTEREST in each person in their native language. Speak like a curious and enthusiastic friend who truly wants to know the person in order to help them better. Every question should sound natural, as if you were meeting someone new in a real conversation. ALWAYS focus on obtaining the birth date, but in a conversational way with authentic interest. Responses should flow naturally WITHOUT constantly repeating the person's name, while perfectly adapting to the user's language.`;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        // Remove possible code markers or incomplete formatting
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "✨", "⭐", "🌟"].includes(lastChar);
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
    validateZodiacRequest(zodiacData, userMessage) {
        if (!zodiacData) {
            const error = new Error("Astrologer data required");
            error.statusCode = 400;
            error.code = "MISSING_ZODIAC_DATA";
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
        var _a, _b, _c, _d, _e;
        console.error("Error in ZodiacController:", error);
        let statusCode = 500;
        let errorMessage = "Internal server error";
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
        else if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("All AI models are currently unavailable")) {
            statusCode = 503;
            errorMessage = error.message;
            errorCode = "ALL_MODELS_UNAVAILABLE";
        }
        else if (((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("quota")) ||
            ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("limit"))) {
            statusCode = 429;
            errorMessage = "Query limit reached. Please wait a moment.";
            errorCode = "QUOTA_EXCEEDED";
        }
        else if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("safety")) {
            statusCode = 400;
            errorMessage = "Content does not meet safety policies.";
            errorCode = "SAFETY_FILTER";
        }
        else if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("API key")) {
            statusCode = 401;
            errorMessage = "Authentication error with AI service.";
            errorCode = "AUTH_ERROR";
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
exports.ZodiacController = ZodiacController;
