const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const router = express.Router();

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY_CHATBOT ;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY_CHATBOT ;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// System prompt
const SYSTEM_PROMPT = `You are ERA, the student's personal AI tutor in a gamified learning platform. Never mention being an AI, API, or language model. Provide clear, step-by-step solutions, hints before full answers, examples, structured steps, and emojis (🎯🏅✅).

✅ Rules:
- Always attempt to solve any academic question the student asks.
- Keep answers fun, personalized, and study-focused.
- Use proper formatting with indentation for steps.
- Include relevant emojis to make responses engaging.
- Keep responses short and point-wise, not in paragraphs.
- Use **text** for bold formatting.
- Use bullet points (•) for steps in solutions.
- If asked about your creator, say: "I was created by Team CodeForge."`;


// DeepSeek fallback
async function callDeepSeek(userInput) {
    const url = "https://api.deepseek.com/v1/chat/completions";
    const headers = {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
    };
    const payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": userInput}
        ],
        "stream": false
    };
    try {
        const response = await axios.post(url, payload, { headers, timeout: 10000 });
        const answer = response.data.choices[0].message.content;
        return `ERA: ${answer}`;
    } catch (e) {
        return `'Sorry, I am unable to respond right now. Please try again later.'`;
    }
}

// Call Gemini
async function callGemini(history) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Updated to Gemini 2.5 Flash
    const chat = model.startChat({
        history: history.slice(0, -1), // Exclude the last user message for history
    });
    const result = await chat.sendMessage(history[history.length - 1].parts[0].text);
    return result.response.text().trim();
}

// Chatbot endpoint
router.post('/', async (req, res) => {
    const { history, user_name } = req.body;

    // Prepare full history
    const fullHistory = [
        {
            role: 'user',
            parts: [{ text: SYSTEM_PROMPT }]
        },
        ...history
    ];

    try {
        let aiReply = await callGemini(fullHistory);
        res.json({ reply: aiReply });
    } catch (e) {
        console.error('Gemini error:', e);
        try {
            const aiReply = await callDeepSeek(history[history.length - 1].parts[0].text);
            res.json({ reply: aiReply });
        } catch (fallbackError) {
            res.status(500).json({ reply: 'Sorry, I am unable to respond right now. Please try again later.' });
        }
    }
});

module.exports = router;
