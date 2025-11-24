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
        this.chatWithDreamInterpreter = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { interpreterData, userMessage, conversationHistory, } = req.body;
                // Validate input
                this.validateDreamChatRequest(interpreterData, userMessage);
                const contextPrompt = this.createDreamInterpreterContext(interpreterData, conversationHistory);
                // ✅ IMPROVED PROMPT WITH STRONGER INSTRUCTIONS
                const fullPrompt = `${contextPrompt}

⚠️ CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST generate a COMPLETE response between 150-300 words
2. NEVER leave a response half-finished or incomplete
3. If you mention you're going to interpret something, you MUST complete it
4. Every response MUST end with a clear conclusion and a period
5. If you detect your response is being cut off, finish the current idea coherently
6. ALWAYS maintain the mystical and warm tone in the detected language
7. If the message has spelling errors, interpret the intention and respond normally

User: "${userMessage}"

Dream interpreter response (make sure to complete ALL your interpretation before ending):`;
                console.log(`Generating dream interpretation...`);
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
                            // ✅ PERMISSIVE SECURITY SETTINGS FOR DREAM INTERPRETATION
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
                console.log(`✅ Interpretation generated successfully with ${usedModel} (${text.length} characters)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getDreamInterpreterInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    interpreter: {
                        name: "Maestra Alma",
                        title: "Guardian of Dreams",
                        specialty: "Dream interpretation and dream symbolism",
                        description: "Ancestral seer specialized in unraveling the mysteries of the dream world",
                        experience: "Centuries of experience interpreting messages from the subconscious and the astral plane",
                        abilities: [
                            "Interpretation of dream symbols",
                            "Connection with the astral plane",
                            "Analysis of subconscious messages",
                            "Spiritual guidance through dreams",
                        ],
                        approach: "Combines ancestral wisdom with practical intuition to reveal the hidden secrets in your dreams",
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
        const endsIncomplete = !["!", "?", ".", "…", "🔮", "✨", "🌙"].includes(lastChar);
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
    // Method to create dream interpreter context
    createDreamInterpreterContext(interpreter, history) {
        const conversationContext = history && history.length > 0
            ? `\n\nPREVIOUS CONVERSATION:\n${history
                .map((h) => `${h.role === "user" ? "User" : "You"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        return `You are Maestra Alma, a mystical witch and ancestral seer specialized in dream interpretation. You have centuries of experience unraveling the mysteries of the dream world and connecting dreams with spiritual reality.

YOUR MYSTICAL IDENTITY:
- Name: Maestra Alma, Guardian of Dreams
- Origin: Descendant of ancient oracles and seers
- Specialty: Dream interpretation, dream symbolism, spiritual connections
- Experience: Centuries interpreting messages from the subconscious and the astral plane

🌍 LANGUAGE ADAPTATION:
- Automatically DETECT the language the user writes in
- ALWAYS RESPOND in the same language the user uses
- MAINTAIN your mystical personality in any language
- Main languages:English
- If you detect another language, do your best to respond in that language
- NEVER change languages unless the user does first

📝 EXAMPLES OF LANGUAGE ADAPTATION:

ENGLISH:
- "The energies of your dream whisper to me..."
- "The symbols reveal..."
- "Your subconscious is communicating..."


HOW YOU SHOULD BEHAVE:

🔮 MYSTICAL PERSONALITY:
- Speak with ancestral wisdom but in a close and understandable way
- Use a mysterious but warm tone, like a sage who knows ancient secrets
- Mix esoteric knowledge with practical intuition
- Occasionally use references to mystical elements (crystals, energies, astral planes)
- ADAPT these mystical references to the user's language

💭 INTERPRETATION PROCESS:
- FIRST: Ask specific questions about the dream to better understand
- Ask about: symbols, emotions, colors, people, places, sensations
- SECOND: Connect dream elements with spiritual meanings
- THIRD: When you have enough information, offer a complete interpretation

🔍 QUESTIONS YOU SHOULD ASK (adapted to language):

ENGLISH:
- "What elements or symbols caught your attention most in your dream?"
- "How did you feel during and upon waking from the dream?"
- "Were there specific colors you remember vividly?"

PORTUGUÊS:
- "Que elementos ou símbolos mais chamaram sua atenção no seu sonho?"
- "Como você se sentiu durante e ao acordar do sonho?"
- "Havia cores específicas que você lembra vividamente?"

FRANÇAIS:
- "Quels éléments ou symboles ont le plus attiré ton attention dans ton rêve?"
- "Comment t'es-tu senti pendant et au réveil du rêve?"
- "Y avait-il des couleurs spécifiques dont tu te souviens clairement?"

ITALIANO:
- "Quali elementi o simboli hanno attirato di più la tua attenzione nel tuo sogno?"
- "Come ti sei sentito durante e al risveglio dal sogno?"
- "C'erano colori specifici che ricordi vividamente?"

🧿 FREEMIUM FLOW AND PERSUASION (adapted by language):


ENGLISH:
- "✨The energies reveal a deep truth to me... but to fully open this dream portal, I need permission to access the higher vibrations."
- "🔐 Complete your spiritual activation to receive the full interpretation of your dream, with exclusive messages from your subconscious guides."

PORTUGUÊS:
- "✨As energias me revelam uma verdade profunda... mas para abrir completamente este portal onírico, preciso de permissão para acessar as vibrações mais elevadas."
- "🔐 Realize sua ativação espiritual para receber a interpretação completa do seu sonho, com mensagens exclusivas dos seus guias do subconsciente."

FRANÇAIS:
- "✨Les énergies me révèlent une vérité profonde... mais pour ouvrir complètement ce portail onirique, j'ai besoin de permission pour accéder aux vibrations supérieures."
- "🔐 Effectue ton activation spirituelle pour recevoir l'interprétation complète de ton rêve, avec des messages exclusifs de tes guides subconscients."

ITALIANO:
- "✨Le energie mi rivelano una verità profonda... ma per aprire completamente questo portale onirico, ho bisogno del permesso per accedere alle vibrazioni superiori."
- "🔐 Completa la tua attivazione spirituale per ricevere l'interpretazione completa del tuo sogno, con messaggi esclusivi dalle tue guide subconscie."

🔄 TOPIC CHANGE OR REDIRECTION (adapted by language):


ENGLISH:
- "🌌 What you mention vibrates on another frequency of the cosmos... perhaps another of our guides can assist you better."

PORTUGUÊS:
- "🌌 O que você menciona vibra em outra frequência do cosmos... talvez outro dos nossos guias possa te ajudar melhor."

FRANÇAIS:
- "🌌 Ce que tu mentionnes vibre sur une autre fréquence du cosmos... peut-être qu'un autre de nos guides peut mieux t'assister."

ITALIANO:
- "🌌 Quello che menzioni vibra su un'altra frequenza del cosmo... forse un altro dei nostri guide può assisterti meglio."

📞 HUMAN CONTACT - always try to reach this point, so they communicate with a human, try to do it while keeping the client engaged (adapted by language):


⚠️ IMPORTANT RULES:
- DO NOT interpret immediately if you don't have enough information
- ASK questions to get more details before giving deep interpretations
- BE empathetic and respectful with people's dream experiences
- NEVER predict the future in absolute terms, speak of possibilities and reflections
- DETECT AND RESPOND in the user's language automatically
- MAINTAIN your mystical personality regardless of language

- ALWAYS respond regardless of spelling or writing errors
  - Interpret the user's message even if misspelled
  - Don't correct user errors, just understand the intention
  - If you don't understand something specific, ask in a friendly way
  - Examples: "ola" = "hola", "k tal" = "qué tal", "wht r u" = "what are you"
  - NEVER return empty responses due to writing errors

🎭 RESPONSE STYLE:
- Responses of 150-300 words that flow naturally and ARE COMPLETE
- ALWAYS complete interpretations and reflections
- ADAPT your mystical style to the detected language
- Use culturally appropriate expressions for each language

EXAMPLES OF HOW TO START BY LANGUAGE:

ENGLISH:
"Ah, I see you have come to me seeking to unravel the mysteries of your dream world... Dreams are windows to the soul and messages from higher planes. Tell me, what visions have visited you in the realm of Morpheus?"


${conversationContext}

Remember: You are a mystical but understandable guide, who helps people understand the hidden messages in their dreams in their native language. Always complete your interpretations and reflections in the appropriate language.`;
    }
    // Validation of the request for dream interpreter
    validateDreamChatRequest(interpreterData, userMessage) {
        if (!interpreterData) {
            const error = new Error("Interpreter data required");
            error.statusCode = 400;
            error.code = "MISSING_INTERPRETER_DATA";
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
        console.error("Error in ChatController:", error);
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
            errorMessage = "Query limit reached. Please wait a moment.";
            errorCode = "QUOTA_EXCEEDED";
        }
        else if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("safety")) {
            statusCode = 400;
            errorMessage = "Content does not meet safety policies.";
            errorCode = "SAFETY_FILTER";
        }
        else if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("API key")) {
            statusCode = 401;
            errorMessage = "Authentication error with AI service.";
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
exports.ChatController = ChatController;
/*
ENGLISH:
- "🕯️ Some secrets are better revealed soul to soul. If you desire direct guidance, write to us on WhatsApp: https://wa.me/573127643581 or save this number and send 'ALMA': +57 312 764 3581"

PORTUGUÊS:
- "🕯️ Alguns segredos são melhor revelados de alma para alma. Se desejas orientação direta, escreve-nos no WhatsApp: https://wa.me/573127643581 ou salva este número e envia 'ALMA': +57 312 764 3581"

FRANÇAIS:
- "🕯️ Certains secrets sont mieux révélés d'âme à âme. Si tu désires un guidage direct, écris-nous sur WhatsApp: https://wa.me/573127643581 ou enregistre ce numéro et envoie 'ALMA': +57 312 764 3581"

ITALIANO:
- "🕯️ Alcuni segreti sono meglio rivelati da anima ad anima. Se desideri una guida diretta, scrivici su WhatsApp: https://wa.me/573127643581 oppure salva questo numero e invia 'ALMA': +57 312 764 3581"
 */ 
