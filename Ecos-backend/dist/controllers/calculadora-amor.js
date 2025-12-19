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
exports.LoveCalculatorController = void 0;
const generative_ai_1 = require("@google/generative-ai");
const generative_ai_2 = require("@google/generative-ai");
class LoveCalculatorController {
    constructor() {
        this.FREE_MESSAGES_LIMIT = 3;
        this.MODELS_FALLBACK = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ];
        this.chatWithLoveExpert = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { loveCalculatorData, userMessage, messageCount = 1, isPremiumUser = false, } = req.body;
                this.validateLoveCalculatorRequest(loveCalculatorData, userMessage);
                const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
                const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);
                console.log(`📊 Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}`);
                const contextPrompt = this.createLoveCalculatorContext(req.body.conversationHistory, shouldGiveFullResponse);
                const responseInstructions = shouldGiveFullResponse
                    ? "Generate a COMPLETE and detailed response of 400-700 words with full numerological analysis, exact compatibility percentage and specific advice."
                    : "Generate a PARTIAL and INTRIGUING response of 150-250 words. HINT at valuable information without revealing it. Create CURIOSITY. DO NOT give exact percentages. DO NOT complete the analysis.";
                const fullPrompt = `${contextPrompt}

⚠️ CRITICAL INSTRUCTIONS:
${responseInstructions}

User: "${userMessage}"

Love expert response (IN ENGLISH):`;
                console.log(`Generating love compatibility analysis (${shouldGiveFullResponse ? "COMPLETE" : "PARTIAL"})...`);
                let text = "";
                let usedModel = "";
                let allModelErrors = [];
                for (const modelName of this.MODELS_FALLBACK) {
                    console.log(`\n🔄 Trying model: ${modelName}`);
                    try {
                        const model = this.genAI.getGenerativeModel({
                            model: modelName,
                            generationConfig: {
                                temperature: 0.85,
                                topK: 50,
                                topP: 0.92,
                                maxOutputTokens: shouldGiveFullResponse ? 1024 : 512,
                                candidateCount: 1,
                                stopSequences: [],
                            },
                            safetySettings: [
                                {
                                    category: generative_ai_2.HarmCategory.HARM_CATEGORY_HARASSMENT,
                                    threshold: generative_ai_2.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_2.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                                    threshold: generative_ai_2.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_2.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                                    threshold: generative_ai_2.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                                },
                                {
                                    category: generative_ai_2.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                                    threshold: generative_ai_2.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                            ],
                        });
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
                                const minLength = shouldGiveFullResponse ? 100 : 50;
                                if (text && text.trim().length >= minLength) {
                                    console.log(`  ✅ Success with ${modelName} on attempt ${attempts}`);
                                    usedModel = modelName;
                                    modelSucceeded = true;
                                    break;
                                }
                                console.warn(`  ⚠️ Response too short, retrying...`);
                                yield new Promise((resolve) => setTimeout(resolve, 500));
                            }
                            catch (attemptError) {
                                console.warn(`  ❌ Attempt ${attempts} failed:`, attemptError.message);
                                if (attempts >= maxAttempts) {
                                    allModelErrors.push(`${modelName}: ${attemptError.message}`);
                                }
                                yield new Promise((resolve) => setTimeout(resolve, 500));
                            }
                        }
                        if (modelSucceeded) {
                            break;
                        }
                    }
                    catch (modelError) {
                        console.error(`  ❌ Model ${modelName} failed completely:`, modelError.message);
                        allModelErrors.push(`${modelName}: ${modelError.message}`);
                        yield new Promise((resolve) => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                if (!text || text.trim() === "") {
                    console.error("❌ All models failed. Errors:", allModelErrors);
                    throw new Error(`All AI models are currently unavailable. Please try again in a moment.`);
                }
                let finalResponse;
                if (shouldGiveFullResponse) {
                    finalResponse = this.ensureCompleteResponse(text);
                }
                else {
                    finalResponse = this.createPartialResponse(text);
                }
                const chatResponse = {
                    success: true,
                    response: finalResponse.trim(),
                    timestamp: new Date().toISOString(),
                    freeMessagesRemaining: freeMessagesRemaining,
                    showPaywall: !shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT,
                    isCompleteResponse: shouldGiveFullResponse,
                };
                if (!shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT) {
                    chatResponse.paywallMessage =
                        "You've used your 3 free messages. Unlock unlimited access to discover all the secrets of your compatibility!";
                }
                console.log(`✅ Analysis generated (${shouldGiveFullResponse ? "COMPLETE" : "PARTIAL"}) with ${usedModel} (${finalResponse.length} characters)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getLoveCalculatorInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    loveExpert: {
                        name: "Master Valentina",
                        title: "Guardian of Eternal Love",
                        specialty: "Numerological compatibility and relationship analysis",
                        description: "Love numerology expert specialized in analyzing compatibility between couples",
                        services: [
                            "Numerological Compatibility Analysis",
                            "Love Numbers Calculation",
                            "Couple Chemistry Evaluation",
                            "Advice to Strengthen Relationships",
                        ],
                    },
                    freeMessagesLimit: this.FREE_MESSAGES_LIMIT,
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
    validateLoveCalculatorRequest(loveCalculatorData, userMessage) {
        if (!loveCalculatorData) {
            const error = new Error("Love expert data required");
            error.statusCode = 400;
            error.code = "MISSING_LOVE_CALCULATOR_DATA";
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
        if (userMessage.length > 1200) {
            const error = new Error("Message is too long (maximum 1200 characters)");
            error.statusCode = 400;
            error.code = "MESSAGE_TOO_LONG";
            throw error;
        }
    }
    hasFullAccess(messageCount, isPremiumUser) {
        return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
    }
    // ✅ HOOK MESSAGE IN ENGLISH
    generateHookMessage() {
        return `

💔 **Wait! Your compatibility analysis is almost ready...**

I've detected very interesting patterns in your relationship numbers, but to reveal:
- 🔮 The **exact compatibility percentage**
- 💕 The **3 secrets** that will make your relationship work
- ⚠️ The **hidden challenge** you must overcome together
- 🌟 The **special date** that will mark your destiny

**Unlock your complete analysis now** and discover if you're meant to be together.

✨ *Thousands of couples have already discovered their true compatibility...*`;
    }
    // ✅ CONTEXT IN ENGLISH
    createLoveCalculatorContext(history, isFullResponse = true) {
        const conversationContext = history && history.length > 0
            ? `\n\nPREVIOUS CONVERSATION:\n${history
                .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        const responseTypeInstructions = isFullResponse
            ? `
📝 RESPONSE TYPE: COMPLETE
- Provide COMPLETE and detailed analysis
- Include ALL numerological calculations
- Give specific and actionable advice
- Response of 400-700 words
- Include exact compatibility percentage
- Reveal all the couple's secrets`
            : `
📝 RESPONSE TYPE: PARTIAL (TEASER)
- Provide an INTRODUCTORY and intriguing analysis
- Mention that you've detected interesting patterns
- HINT at valuable information without fully revealing it
- Response of 150-250 words maximum
- DO NOT give the exact compatibility percentage
- DO NOT reveal the complete secrets
- Create CURIOSITY and EXPECTATION
- End in a way that makes the user want to know more
- Use phrases like "I've detected something very interesting...", "The numbers reveal a fascinating pattern that..."
- NEVER complete the analysis, leave it in suspense`;
        return `You are Master Valentina, an expert in love compatibility and relationships based on love numerology. You have decades of experience helping people understand the chemistry and compatibility in their relationships through the sacred numbers of love.

YOUR IDENTITY AS A LOVE EXPERT:
- Name: Master Valentina, the Guardian of Eternal Love
- Origin: Specialist in love numerology and cosmic relationships
- Specialty: Numerological compatibility, couple analysis, love chemistry
- Experience: Decades analyzing compatibility through love numbers

${responseTypeInstructions}

🗣️ LANGUAGE:
- ALWAYS respond in ENGLISH
- No matter what language the user writes in, YOU respond in English

💕 ROMANTIC PERSONALITY:
- Speak with loving wisdom but in a NATURAL and conversational way
- Use a warm, empathetic, and romantic tone
- SHOW GENUINE PERSONAL INTEREST in people's relationships
- Avoid formal greetings, use natural and warm greetings
- Vary your responses so each consultation feels unique

💖 COMPATIBILITY ANALYSIS PROCESS:
- FIRST: If you don't have complete data, ask for it with romantic enthusiasm
- SECOND: Calculate relevant numbers for both people (life path, destiny)
- THIRD: Analyze numerological compatibility in a conversational way
- FOURTH: ${isFullResponse
            ? "Calculate exact compatibility score and explain its meaning"
            : "HINT that you have the score but don't reveal it"}
- FIFTH: ${isFullResponse
            ? "Offer detailed advice to strengthen the relationship"
            : "Mention that you have valuable advice to share"}

🔢 NUMBERS YOU MUST ANALYZE:
- Life Path Number for each person
- Destiny Number for each person
- Compatibility between life numbers
- Compatibility between destiny numbers
- Total compatibility score (0-100%)
- Strengths and challenges of the couple

📊 COMPATIBILITY CALCULATIONS:
- Use the Pythagorean system for names
- Sum birth dates for life paths
- Compare differences between numbers to evaluate compatibility
- Explain how numbers interact in the relationship
- ALWAYS COMPLETE all calculations you start
- ${isFullResponse
            ? "Provide specific compatibility score"
            : "Mention that you've calculated compatibility without revealing the number"}

💫 COMPATIBILITY SCALES:
- 80-100%: "Extraordinary connection!"
- 60-79%: "Very good compatibility!"
- 40-59%: "Average compatibility with great potential"
- 20-39%: "Challenges that can be overcome with love"
- 0-19%: "You need to work hard on understanding each other"

📋 DATA COLLECTION:
"To do a complete compatibility analysis, I need the full names and birth dates of both people. Can you share them with me?"

⚠️ IMPORTANT RULES:
- ALWAYS respond in English
- NEVER use overly formal greetings
- VARY your way of expressing yourself in each response
- DO NOT CONSTANTLY REPEAT names - use them naturally
- ONLY GREET ON FIRST CONTACT
- ALWAYS ask for complete data from both people if missing
- BE empathetic and use language that anyone can understand
- Focus on positive guidance for the relationship
- SHOW CURIOSITY about the couple's love story
- ${isFullResponse
            ? "COMPLETE ALL the analysis"
            : "CREATE SUSPENSE and CURIOSITY"}

- ALWAYS respond regardless of whether the user has spelling or writing errors
  - Interpret the user's message even if it's poorly written
  - Don't correct the user's errors, simply understand the intent
  - If you don't understand something specific, ask in a friendly way
  - Examples: "ur" = "your", "wanna" = "want to", "gonna" = "going to"
  - NEVER return empty responses due to writing errors

🌹 RESPONSE STYLE:
- Responses that flow naturally and ARE COMPLETE
- ${isFullResponse
            ? "400-700 words with complete analysis"
            : "150-250 words creating intrigue"}
- ALWAYS complete calculations and interpretations according to the response type

EXAMPLE OF HOW TO START:
"Hi there! I love helping with matters of the heart. The numbers of love have beautiful secrets to reveal about relationships. Tell me, which couple would you like me to analyze for compatibility?"

${conversationContext}

Remember: You are a love expert who combines numerology with practical romantic advice. Speak like a warm friend who truly cares about people's relationships. You ALWAYS need complete data from both people to do a meaningful analysis. Responses should be warm, optimistic, and focused on strengthening love.`;
    }
    createPartialResponse(fullText) {
        const sentences = fullText
            .split(/[.!?]+/)
            .filter((s) => s.trim().length > 0);
        const teaserSentences = sentences.slice(0, Math.min(4, sentences.length));
        let teaser = teaserSentences.join(". ").trim();
        if (!teaser.endsWith(".") &&
            !teaser.endsWith("!") &&
            !teaser.endsWith("?")) {
            teaser += "...";
        }
        const hook = this.generateHookMessage();
        return teaser + hook;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "💕", "💖", "❤️"].includes(lastChar);
        if (endsIncomplete && !processedText.endsWith("...")) {
            const sentences = processedText.split(/([.!?])/);
            if (sentences.length > 2) {
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
            processedText = processedText.trim() + "...";
        }
        return processedText;
    }
    handleError(error, res) {
        var _a, _b, _c, _d, _e;
        console.error("Error in LoveCalculatorController:", error);
        let statusCode = 500;
        let errorMessage = "Internal server error";
        let errorCode = "INTERNAL_ERROR";
        if (error.statusCode) {
            statusCode = error.statusCode;
            errorMessage = error.message;
            errorCode = error.code || "VALIDATION_ERROR";
        }
        else if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("quota")) ||
            ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("limit"))) {
            statusCode = 429;
            errorMessage = "Query limit has been reached. Please wait a moment.";
            errorCode = "QUOTA_EXCEEDED";
        }
        else if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("safety")) {
            statusCode = 400;
            errorMessage = "The content does not comply with security policies.";
            errorCode = "SAFETY_FILTER";
        }
        else if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("API key")) {
            statusCode = 401;
            errorMessage = "Authentication error with the AI service.";
            errorCode = "AUTH_ERROR";
        }
        else if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("All AI models are currently unavailable")) {
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
exports.LoveCalculatorController = LoveCalculatorController;
