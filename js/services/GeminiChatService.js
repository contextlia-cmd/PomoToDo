export class GeminiChatService {
    constructor() {
        this.apiKey = localStorage.getItem('gemini_api_key') || '';
        this.systemPrompt = localStorage.getItem('gemini_system_prompt') || '';
        this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.chatHistory = []; // { role: 'user' | 'model', parts: [{ text: string }] }
    }

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('gemini_api_key', key);
        if (window.app && window.app.syncService) {
            window.app.syncService.triggerSync();
        }
    }

    getApiKey() {
        return this.apiKey;
    }

    hasApiKey() {
        return !!this.apiKey && this.apiKey.trim().length > 0;
    }

    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
        localStorage.setItem('gemini_system_prompt', prompt);
        if (window.app && window.app.syncService) {
            window.app.syncService.triggerSync();
        }
    }

    getSystemPrompt() {
        return this.systemPrompt;
    }

    clearHistory() {
        this.chatHistory = [];
    }

    async sendMessage(messageText) {
        if (!this.hasApiKey()) {
            throw new Error('API Key is not set');
        }

        // Add user message to history
        this.chatHistory.push({
            role: 'user',
            parts: [{ text: messageText }]
        });

        const url = `${this.endpoint}?key=${this.apiKey}`;
        const requestBody = {
            contents: this.chatHistory,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
            }
        };

        // Add system instruction if exists
        if (this.systemPrompt && this.systemPrompt.trim().length > 0) {
            requestBody.systemInstruction = {
                parts: [{ text: this.systemPrompt }]
            };
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Gemini API Error:', errorData);

                // Keep history clean on error by popping the user message we just pushed
                this.chatHistory.pop();

                if (response.status === 400 && errorData.error?.message?.includes('API key not valid')) {
                    throw new Error('API Keyが無効です。正しいキーを入力してください。');
                }
                throw new Error(errorData.error?.message || 'APIとの通信中にエラーが発生しました');
            }

            const data = await response.json();

            // Extract AI response
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const aiResponseContent = data.candidates[0].content;
                const aiMessageText = aiResponseContent.parts[0].text;

                // Save AI response to history
                this.chatHistory.push({
                    role: 'model',
                    parts: [{ text: aiMessageText }]
                });

                return aiMessageText;
            } else {
                return 'すみません、応答をうまく生成できませんでした。';
            }

        } catch (error) {
            console.error('Chat Service Error:', error);
            throw error;
        }
    }

    async generateMisaGreeting() {
        if (!this.hasApiKey()) {
            throw new Error('API Key is not set');
        }

        const url = `${this.endpoint}?key=${this.apiKey}`;

        // Build a prompt based on current time to give context
        const now = new Date();
        const hour = now.getHours();
        let timeContext = "日中";
        if (hour >= 5 && hour < 10) timeContext = "朝";
        else if (hour >= 10 && hour < 17) timeContext = "昼";
        else if (hour >= 17 && hour < 22) timeContext = "夜";
        else timeContext = "深夜";

        const basePrompt = `あなたはユーザーの作業をサポートするアシスタントbot「Misa」です。
現在の時間帯は「${timeContext}（${hour}時台）」です。
状況に合った、短く親しみやすい一言（1〜2文程度）をランダムにつぶやいてください。
ユーザーからの質問に対する回答ではなく、独り言や軽い声かけのような内容にしてください。`;

        const requestBody = {
            contents: [{
                role: 'user',
                parts: [{ text: basePrompt }]
            }],
            generationConfig: {
                temperature: 0.9, // Higher temp for more variety in greetings
                maxOutputTokens: 800, // Increased as requested
            }
        };

        // Add user defined system instruction if exists
        if (this.systemPrompt && this.systemPrompt.trim().length > 0) {
            requestBody.systemInstruction = {
                parts: [{ text: this.systemPrompt }]
            };
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Failed to generate greeting');
            }

            const data = await response.json();

            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Greeting Generation Error:', error);
            return null; // silently fail and allow caller to use fallback
        }
    }
}
