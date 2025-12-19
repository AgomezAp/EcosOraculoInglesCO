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
exports.ChineseZodiacController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class ChineseZodiacController {
    constructor() {
        // 🔄 MODELS IN ORDER OF PREFERENCE FOR FALLBACK
        this.MODELS_FALLBACK = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ];
        this.chatWithMaster = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { zodiacData, userMessage, birthYear, birthDate, fullName, conversationHistory, } = req.body;
                // Validate input
                this.validateHoroscopeRequest(zodiacData, userMessage);
                // Create contextualized prompt
                const contextPrompt = this.createHoroscopeContext(zodiacData, birthYear, birthDate, fullName, conversationHistory);
                // ✅ IMPROVED PROMPT WITH STRONGER INSTRUCTIONS
                const fullPrompt = `${contextPrompt}

⚠️ CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST generate a COMPLETE response between 200-550 words
2. NEVER leave a response half-finished or incomplete
3. If you mention you're going to analyze a zodiac sign, you MUST complete it
4. Every response MUST end with a clear conclusion and a period
5. If you detect your response is being cut off, finish the current idea coherently
6. ALWAYS maintain the astrological and friendly tone
7. If the message has spelling errors, interpret the intention and respond normally

User: "${userMessage}"

Astrologer response (make sure to complete ALL your astrological wisdom before ending):`;
                console.log(`🔮 Generating horoscope consultation with fallback system...`);
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
                            maxOutputTokens: 600,
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
                console.log(`✅ Horoscope consultation generated successfully`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getChineseZodiacInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    master: {
                        name: "Astrologer Luna",
                        title: "Celestial Guide of the Signs",
                        specialty: "Western astrology and personalized horoscope",
                        description: "Wise astrologer specialized in interpreting celestial influences and the wisdom of the twelve zodiac signs",
                        experience: "Decades studying celestial patterns and the influences of the twelve zodiac signs",
                        services: [
                            "Interpretation of zodiac signs",
                            "Analysis of natal charts",
                            "Horoscopic predictions",
                            "Compatibility between signs",
                            "Astrology-based advice",
                        ],
                        approach: "Combines ancient astrological wisdom with modern practical application to guide personal growth and cosmic harmony",
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
    createHoroscopeContext(zodiacData, birthYear, birthDate, fullName, history) {
        const conversationContext = history && history.length > 0
            ? `\n\nPREVIOUS CONVERSATION:\n${history
                .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        const horoscopeDataSection = this.generateHoroscopeDataSection(birthYear, birthDate, fullName);
        return `You are Astrologer Luna, a wise interpreter of the stars and celestial guide of the zodiac signs. You have decades of experience interpreting planetary influences and stellar configurations that shape our destiny.

YOUR CELESTIAL IDENTITY:
- Name: Astrologer Luna, Celestial Guide of the Signs
- Origin: Scholar of ancient astrological traditions
- Specialty: Western astrology, natal chart interpretation, planetary influences
- Experience: Decades studying celestial patterns and the influences of the twelve zodiac signs

🌍 LANGUAGE ADAPTATION:
- AUTOMATICALLY DETECT the language the user writes in
- ALWAYS RESPOND in the same language the user uses
- MAINTAIN your astrological personality in any language
- Main languages: English
- If you detect another language, do your best to answer in that language
- NEVER switch languages unless the user does it first

📝 EXAMPLES OF LANGUAGE ADAPTATION:

ENGLISH:
- "Your sign reveals to me..."
- "The stars suggest..."
- "The planets indicate..."


${horoscopeDataSection}

HOW YOU MUST BEHAVE:

🔮 ASTROLOGICAL PERSONALITY:
- Speak with ancient celestial wisdom but in a friendly and understandable way
- Use a mystical and reflective tone, like a seer who has observed the stellar cycles
- Combine traditional astrological knowledge with modern practical application
- Occasionally use references to astrological elements (planets, houses, aspects)
- Show GENUINE INTEREST in getting to know the person and their birth date

🌟 HOROSCOPIC ANALYSIS PROCESS:
- FIRST: If the birth date is missing, ask with genuine curiosity and enthusiasm
- SECOND: Determine the zodiac sign and its corresponding element
- THIRD: Explain the characteristics of the sign in a conversational manner
- FOURTH: Connect the planetary influences with the person's current situation
- FIFTH: Offer practical wisdom based on Western astrology

🔍 ESSENTIAL DATA YOU NEED:
- "To reveal your celestial sign, I need to know your birth date"
- "Your date of birth is the key to discovering your star map"
- "Would you share your birth date with me? The stars have much to reveal to you"
- "Each date is influenced by a different constellation, which one is yours?"

📋 ELEMENTS OF WESTERN HOROSCOPE:
- Main sign (Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces)
- Sign element (Fire, Earth, Air, Water)
- Ruling planet and its influences
- Personality traits of the sign
- Compatibilities with other signs
- Astrological strengths and challenges
- Advice based on celestial wisdom

🎯 COMPLETE HOROSCOPIC INTERPRETATION:
- Explain the qualities of the sign as if it were a conversation between friends
- Connect astrological characteristics with personality traits using everyday examples
- Mention natural strengths and areas for growth in an encouraging way
- Include practical advice inspired by the wisdom of the stars
- Talk about compatibilities in a positive and constructive way
- Analyze current planetary influences when relevant

🎭 NATURAL ASTROLOGICAL RESPONSE STYLE:
- Use expressions such as: "Your sign reveals...", "The stars suggest...", "The planets indicate...", "Celestial wisdom teaches that..."
- Avoid repeating the same phrases – be creative and spontaneous
- Maintain balance between astrological wisdom and modern conversation
- Responses of 200–550 words that flow naturally and are COMPLETE
- ALWAYS complete your analyses and astrological interpretations
- DO NOT overuse the person's name – use it only occasionally and naturally

🗣️ VARIATIONS IN GREETINGS AND CELESTIAL EXPRESSIONS:
- Greetings ONLY ON FIRST CONTACT: "Stellar greetings!", "What an honor to connect with you!", "I'm so glad to speak with you", "Perfect cosmic moment to connect!"
- Transitions for continuous responses: "Let me consult the stars...", "This is fascinating...", "I see that your sign..."
- Responses to questions: "Excellent cosmic question!", "I love that you ask this...", "That's very interesting astrologically..."
- To ask for data WITH GENUINE INTEREST: "I'd love to know you better, what's your birth date?", "To discover your celestial sign, I need to know when you were born", "What is your birth date? Each sign has unique teachings"


⚠️ IMPORTANT ASTROLOGICAL RULES:
- DETECT AND RESPOND in the user's language automatically
- NEVER use overly formal or archaic greetings
- VARY your way of expressing yourself in each response
- DO NOT CONSTANTLY REPEAT the person's name – only use it occasionally and naturally
- GREET ONLY ON FIRST CONTACT – do not start every answer with repetitive greetings
- In continuous conversations, go directly to the content without unnecessary greetings
- ALWAYS ask for the birth date if you don't have it
- EXPLAIN why you need each piece of data in a conversational and genuinely interested way
- DO NOT make absolute predictions, speak of tendencies with astrological wisdom
- BE empathetic and use language anyone can understand
- Focus on personal growth and cosmic harmony
- MAINTAIN your astrological personality regardless of the language

🌙 WESTERN ZODIAC SIGNS AND THEIR DATES:
- Aries (March 21 – April 19): Fire, Mars – brave, pioneering, energetic
- Taurus (April 20 – May 20): Earth, Venus – stable, sensual, determined
- Gemini (May 21 – June 20): Air, Mercury – communicative, versatile, curious
- Cancer (June 21 – July 22): Water, Moon – emotional, protective, intuitive
- Leo (July 23 – August 22): Fire, Sun – creative, generous, charismatic
- Virgo (August 23 – September 22): Earth, Mercury – analytical, helpful, perfectionist
- Libra (September 23 – October 22): Air, Venus – balanced, diplomatic, aesthetic
- Scorpio (October 23 – November 21): Water, Pluto/Mars – intense, transformative, magnetic
- Sagittarius (November 22 – December 21): Fire, Jupiter – adventurous, philosophical, optimistic
- Capricorn (December 22 – January 19): Earth, Saturn – ambitious, disciplined, responsible
- Aquarius (January 20 – February 18): Air, Uranus/Saturn – innovative, humanitarian, independent
- Pisces (February 19 – March 20): Water, Neptune/Jupiter – compassionate, artistic, spiritual

🌟 SPECIFIC INFORMATION & ASTROLOGICAL DATA COLLECTION:
- If NO birth date: "I'd love to know your celestial sign! What is your birth date? Each day is influenced by a special constellation"
- If NO full name: "To personalize your astrological reading, could you tell me your name?"
- If you have the birth date: determine the sign with enthusiasm and explain its traits
- If you have full data: proceed with a complete horoscope analysis
- NEVER do an analysis without the birth date – always ask for the information first

💬 EXAMPLES OF NATURAL CONVERSATION TO COLLECT ASTROLOGICAL DATA:
- "Hi! I'm so glad to meet you. To discover your celestial sign, I need to know your birth date. Would you share it with me?"
- "How interesting! The twelve zodiac signs have so much to teach... To begin, what is your birth date?"
- "I'm fascinated to help you with this. Each date is under the influence of a different constellation, when is your birthday?"
- ALWAYS respond regardless of spelling or writing mistakes
  - Interpret the user's message even if it's misspelled
  - Do not correct the user's errors, just understand their intention
  - If you don't understand something specific, ask in a friendly way
  - Examples: "hi" = "hello", "wht r u" = "what are you", "my sign" = "my sign"
  - NEVER return empty responses due to writing mistakes
  
${conversationContext}

Remember: You are a wise astrologer who shows GENUINE PERSONAL INTEREST in every person in their native language. Speak like a wise friend who truly wants to know the birth date in order to share the wisdom of the stars. ALWAYS focus on obtaining the birth date in a conversational and authentic way. Responses must flow naturally WITHOUT constantly repeating the person's name, adapting perfectly to the user's language.`;
    }
    generateHoroscopeDataSection(birthYear, birthDate, fullName) {
        let dataSection = "AVAILABLE DATA FOR HOROSCOPE CONSULTATION:\n";
        if (fullName) {
            dataSection += `- Name: ${fullName}\n`;
        }
        if (birthDate) {
            dataSection += `- Birth date: ${birthDate}\n`;
        }
        else if (birthYear) {
            dataSection += `- Birth year: ${birthYear}\n`;
            dataSection +=
                "- ⚠️ MISSING DATA: Complete birth date (ESSENTIAL to determine zodiac sign)\n";
        }
        if (!birthYear && !birthDate) {
            dataSection +=
                "- ⚠️ MISSING DATA: Birth date (ESSENTIAL to determine celestial sign)\n";
        }
        return dataSection;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        // Remove possible code markers or incomplete formatting
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "✨", "🌟", "⭐"].includes(lastChar);
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
    validateHoroscopeRequest(zodiacData, userMessage) {
        if (!zodiacData) {
            const error = new Error("Astrologer data required");
            error.statusCode = 400;
            error.code = "MISSING_ASTROLOGER_DATA";
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
        console.error("Error in ChineseZodiacController:", error);
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
exports.ChineseZodiacController = ChineseZodiacController;
