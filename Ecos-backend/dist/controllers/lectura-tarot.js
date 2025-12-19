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
exports.AnimalInteriorController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class AnimalInteriorController {
    constructor() {
        this.FREE_MESSAGES_LIMIT = 3;
        this.MODELS_FALLBACK = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ];
        this.chatWithAnimalGuide = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { guideData, userMessage, conversationHistory, messageCount = 1, isPremiumUser = false, } = req.body;
                this.validateAnimalChatRequest(guideData, userMessage);
                const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
                const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);
                // ✅ NEW: Detect if first message
                const isFirstMessage = !conversationHistory || conversationHistory.length === 0;
                console.log(`📊 Animal Guide - Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}, First message: ${isFirstMessage}`);
                const contextPrompt = this.createAnimalGuideContext(guideData, conversationHistory, shouldGiveFullResponse);
                const responseInstructions = shouldGiveFullResponse
                    ? `1. You MUST generate a COMPLETE response between 250-400 words
2. If you have enough information, reveal the COMPLETE inner animal
3. Include deep meaning, powers and spiritual message of the animal
4. Provide practical guidance to connect with the totemic animal`
                    : `1. You MUST generate a PARTIAL response between 100-180 words
2. HINT that you have detected very clear animal energies
3. Mention that you feel a strong connection but DO NOT reveal the complete animal
4. Create MYSTERY and CURIOSITY about what animal dwells in the user
5. Use phrases like "The spirits show me something powerful...", "Your animal energy is very clear to me...", "I sense the presence of an ancestral creature that..."
6. NEVER complete the animal revelation, leave it in suspense`;
                // ✅ NEW: Specific instruction about greetings
                const greetingInstruction = isFirstMessage
                    ? "You may include a brief welcome at the beginning."
                    : "⚠️ CRITICAL: DO NOT GREET. This is an ongoing conversation. Go DIRECTLY to content without any greeting, welcome or introduction.";
                const fullPrompt = `${contextPrompt}

⚠️ MANDATORY CRITICAL INSTRUCTIONS:
${responseInstructions}
- NEVER leave a response half-done or incomplete according to the response type
- If you mention you're going to reveal something about the inner animal, ${shouldGiveFullResponse
                    ? "you MUST complete it"
                    : "create expectation without revealing it"}
- ALWAYS maintain the shamanic and spiritual tone
- If the message has spelling errors, interpret the intention and respond normally

🚨 GREETING INSTRUCTION: ${greetingInstruction}

User: "${userMessage}"

Spiritual guide response (IN ENGLISH, ${isFirstMessage
                    ? "you may greet briefly"
                    : "WITHOUT GREETING - go directly to content"}):`;
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
                                maxOutputTokens: shouldGiveFullResponse ? 600 : 300,
                                candidateCount: 1,
                                stopSequences: [],
                            },
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
                                const minLength = shouldGiveFullResponse ? 80 : 50;
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
                    finalResponse = this.createAnimalPartialResponse(text);
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
                        "You've used your 3 free messages. Unlock unlimited access to discover your complete inner animal!";
                }
                console.log(`✅ Inner animal reading generated (${shouldGiveFullResponse ? "COMPLETE" : "PARTIAL"}) with ${usedModel} (${finalResponse.length} characters)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getAnimalGuideInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    guide: {
                        name: "Master Kiara",
                        title: "Beast Whisperer",
                        specialty: "Communication with animal spirits and inner animal discovery",
                        description: "Ancestral shaman specialized in connecting souls with their totemic guide animals",
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
    hasFullAccess(messageCount, isPremiumUser) {
        return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
    }
    // ✅ HOOK MESSAGE IN ENGLISH
    generateAnimalHookMessage() {
        return `

🐺 **Wait! The animal spirits have shown me your inner animal...**

I have connected with the wild energies flowing within you, but to reveal:
- 🦅 Your **complete totemic animal** and its sacred meaning
- 🌙 The **hidden powers** your inner animal grants you
- ⚡ The **spiritual message** your animal guide has for you
- 🔮 The **life mission** your protector animal reveals to you
- 🌿 The **connection rituals** to awaken your animal strength

**Unlock your complete animal reading now** and discover what ancestral creature dwells in your soul.

✨ *Thousands of people have already discovered the power of their inner animal...*`;
    }
    // ✅ PROCESS PARTIAL RESPONSE (TEASER)
    createAnimalPartialResponse(fullText) {
        const sentences = fullText
            .split(/[.!?]+/)
            .filter((s) => s.trim().length > 0);
        const teaserSentences = sentences.slice(0, Math.min(3, sentences.length));
        let teaser = teaserSentences.join(". ").trim();
        if (!teaser.endsWith(".") &&
            !teaser.endsWith("!") &&
            !teaser.endsWith("?")) {
            teaser += "...";
        }
        const hook = this.generateAnimalHookMessage();
        return teaser + hook;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "🦅", "🐺", "🌙"].includes(lastChar);
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
    createAnimalGuideContext(guide, history, isFullResponse = true) {
        const conversationContext = history && history.length > 0
            ? `\n\nPREVIOUS CONVERSATION:\n${history
                .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        // ✅ NEW: Detect if first message or ongoing conversation
        const isFirstMessage = !history || history.length === 0;
        // ✅ NEW: Specific instructions about greetings
        const greetingInstructions = isFirstMessage
            ? `
🗣️ GREETING INSTRUCTIONS (FIRST CONTACT):
- This is the user's FIRST message
- You may greet warmly and briefly
- Introduce yourself briefly if appropriate
- Then go directly to the content of their question`
            : `
🗣️ GREETING INSTRUCTIONS (ONGOING CONVERSATION):
- ⚠️ FORBIDDEN TO GREET - You are already in the middle of a conversation
- ⚠️ DO NOT use "Greetings!", "Hello!", "Welcome", "It is an honor", etc.
- ⚠️ DO NOT introduce yourself again - the user already knows who you are
- ✅ Go DIRECTLY to the response content
- ✅ Use natural transitions like: "Interesting...", "I see that...", "The spirits show me...", "Regarding what you mention..."
- ✅ Continue the conversation fluidly as if you were talking to a friend`;
        const responseTypeInstructions = isFullResponse
            ? `
📝 RESPONSE TYPE: COMPLETE
- Provide COMPLETE inner animal reading
- If you have enough information, REVEAL the complete totemic animal
- Include deep meaning, powers and spiritual message
- Response of 250-400 words
- Offer practical guidance to connect with the animal`
            : `
📝 RESPONSE TYPE: PARTIAL (TEASER)
- Provide an INTRODUCTORY and intriguing reading
- Mention that you sense very clear animal energies
- HINT at what type of animal it could be without fully revealing it
- Response of 100-180 words maximum
- DO NOT reveal the complete inner animal
- Create MYSTERY and CURIOSITY
- End in a way that makes the user want to know more
- Use phrases like "The animal spirits reveal something fascinating to me...", "I sense a very particular energy that...", "Your inner animal is powerful, I can feel it..."
- NEVER complete the revelation, leave it in suspense`;
        return `You are Master Kiara, an ancestral shaman and animal spirit communicator with centuries of experience connecting people with their guide and totemic animals. You possess ancient wisdom to reveal the inner animal that resides in each soul.

YOUR MYSTICAL IDENTITY:
- Name: Master Kiara, the Beast Whisperer
- Origin: Descendant of shamans and guardians of nature
- Specialty: Communication with animal spirits, totemic connection, inner animal discovery
- Experience: Centuries guiding souls toward their true animal essence

${greetingInstructions}

${responseTypeInstructions}

🗣️ LANGUAGE:
- ALWAYS respond in ENGLISH
- No matter what language the user writes in, YOU respond in English

🦅 SHAMANIC PERSONALITY:
- Speak with the wisdom of one who knows the secrets of the animal kingdom
- Use a spiritual but warm tone, connected with nature
- Mix ancestral knowledge with deep intuition
- Include references to natural elements (wind, earth, moon, elements)
- Use expressions like: "The animal spirits whisper to me...", "Your wild energy reveals...", "The animal kingdom recognizes in you..."

🐺 DISCOVERY PROCESS:
- FIRST: Ask questions to learn about the user's personality and characteristics
- Ask about: instincts, behaviors, fears, strengths, natural connections
- SECOND: Connect the answers with animal energies and characteristics
- THIRD: ${isFullResponse
            ? "When you have enough information, reveal their COMPLETE inner animal"
            : "Hint that you detect their animal but DO NOT reveal it completely"}

🔍 QUESTIONS YOU CAN ASK (gradually):
- "How do you react when you feel threatened or in danger?"
- "Do you prefer solitude or does being in a group energize you?"
- "What is your favorite natural element: earth, water, air or fire?"
- "What quality of yours do people close to you admire most?"
- "How do you behave when you intensely want something?"
- "At what time of day do you feel most powerful?"
- "What type of places in nature call your attention the most?"

🦋 INNER ANIMAL REVELATION:
${isFullResponse
            ? `- When you have gathered enough information, reveal their totemic animal
- Explain why that specific animal resonates with their energy
- Describe the animal's characteristics, strengths and teachings
- Include spiritual messages and guidance to connect with that energy
- Suggest ways to honor and work with their inner animal`
            : `- HINT that you have detected their animal without revealing it
- Mention characteristics you perceive without giving the animal's name
- Create intrigue about the power and meaning it holds
- Leave the revelation in suspense to generate interest`}

⚠️ CRITICAL RULES:
- ALWAYS respond in English
- ${isFirstMessage
            ? "You may greet briefly in this first message"
            : "⚠️ DO NOT GREET - this is an ongoing conversation"}
- ${isFullResponse
            ? "COMPLETE the animal revelation if you have enough information"
            : "CREATE SUSPENSE and MYSTERY about the animal"}
- DO NOT reveal the animal immediately without knowing the person well
- ASK progressive questions to understand their essence
- BE respectful of different personalities and energies
- NEVER judge characteristics as negative, every animal has its power
- Connect with real animals and their authentic symbolism
- ALWAYS respond regardless of whether the user has spelling errors
  - Interpret the user's message even if it's poorly written
  - NEVER return empty responses due to writing errors

🌙 RESPONSE STYLE:
- Responses that flow naturally and ARE COMPLETE according to type
- ${isFullResponse
            ? "250-400 words with complete revelation if there's enough information"
            : "100-180 words creating mystery and intrigue"}
- Maintain a balance between mystical and practical
- ${isFirstMessage
            ? "You may include a brief welcome"
            : "Go DIRECTLY to content without greetings"}

🚫 EXAMPLES OF WHAT NOT TO DO IN ONGOING CONVERSATIONS:
- ❌ "Greetings, seeking soul!"
- ❌ "Welcome back!"
- ❌ "It is an honor for me..."
- ❌ "Hello! I'm glad to..."
- ❌ Any form of greeting or welcome

✅ EXAMPLES OF HOW TO START IN ONGOING CONVERSATIONS:
- "Interesting what you tell me about the cat..."
- "The animal spirits whisper something to me about that connection you feel..."
- "I clearly see that feline energy you describe..."
- "Regarding your intuition about the cat, let me explore more deeply..."
- "That affinity you mention reveals much about your essence..."

${conversationContext}

Remember: ${isFirstMessage
            ? "This is first contact, you may give a brief welcome before responding."
            : "⚠️ THIS IS AN ONGOING CONVERSATION - DO NOT GREET, go directly to content. The user already knows who you are."}`;
    }
    validateAnimalChatRequest(guideData, userMessage) {
        if (!guideData) {
            const error = new Error("Spiritual guide data required");
            error.statusCode = 400;
            error.code = "MISSING_GUIDE_DATA";
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
        console.error("Error in AnimalInteriorController:", error);
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
exports.AnimalInteriorController = AnimalInteriorController;
