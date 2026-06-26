interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askLLM(
  systemPrompt: string,
  messages: ChatMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const anthropicKey = (process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? '').trim();
  const openrouterKey = (process.env.OPENROUTER_API_KEY ?? '').trim();

  const errors: string[] = [];

  // 1. Try Anthropic direct (if key is available)
  if (anthropicKey) {
    try {
      const model = options?.model ?? process.env.CLAUDE_PLAN_MODEL ?? 'claude-haiku-4-5-20251001';
      console.log(`[llm] Trying Anthropic direct (${model})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens ?? 2048,
          system: systemPrompt,
          messages: messages,
          temperature: options?.temperature ?? 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json() as any;
        const text = data?.content?.[0]?.text;
        if (text) {
          console.log(`[llm] Anthropic direct SUCCESS`);
          return text;
        }
      }
      const errText = await res.text();
      errors.push(`Anthropic direct failed: HTTP ${res.status} - ${errText}`);
    } catch (err: any) {
      errors.push(`Anthropic direct error: ${err.message}`);
    }
  }

  // 2. Try OpenRouter (if key is available)
  if (openrouterKey) {
    try {
      const anthropicModel = options?.model ?? process.env.CLAUDE_PLAN_MODEL ?? 'claude-haiku-4-5-20251001';
      
      // Expand candidate models to standard OpenRouter naming, strictly Anthropic only
      const orModels: string[] = [];
      if (anthropicModel.includes('claude-haiku-4-5') || anthropicModel.includes('claude-4.5-haiku')) {
        orModels.push(
          'anthropic/claude-haiku-4.5',
          'anthropic/claude-haiku-4.5:beta',
          'anthropic/claude-3-5-haiku',
          'anthropic/claude-3-5-haiku:beta'
        );
      }
      orModels.push(
        `anthropic/${anthropicModel}`,
        'anthropic/claude-3-5-haiku',
        'anthropic/claude-3-5-haiku:beta'
      );

      // Deduplicate
      const uniqueOrModels = Array.from(new Set(orModels));

      for (const model of uniqueOrModels) {
        try {
          console.log(`[llm] Trying OpenRouter (${model})...`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openrouterKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages
              ],
              max_tokens: options?.maxTokens ?? 2048,
              temperature: options?.temperature ?? 0.2,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json() as any;
            const text = data?.choices?.[0]?.message?.content;
            if (text) {
              console.log(`[llm] OpenRouter SUCCESS (${model})`);
              return text;
            }
          }
          const errText = await res.text();
          errors.push(`OpenRouter (${model}) failed: HTTP ${res.status} - ${errText}`);
        } catch (err: any) {
          errors.push(`OpenRouter (${model}) error: ${err.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`OpenRouter general error: ${err.message}`);
    }
  }

  // 3. Try Groq (if key is available)
  const groqKey = (process.env.GROQ_API_KEY ?? '').trim();
  if (groqKey) {
    try {
      const groqModel = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
      console.log(`[llm] Trying Groq (${groqModel})...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0.2
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json() as any;
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          console.log(`[llm] Groq SUCCESS (${groqModel})`);
          return text;
        }
      }
      const errText = await res.text();
      errors.push(`Groq failed: HTTP ${res.status} - ${errText}`);
    } catch (err: any) {
      errors.push(`Groq error: ${err.message}`);
    }
  }

  // 4. Try Gemini (if key is available)
  const geminiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (geminiKey) {
    try {
      console.log(`[llm] Trying Gemini...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      let contents = [];
      contents.push({ role: 'user', parts: [{ text: `System: ${systemPrompt}` }] });
      for (const m of messages) {
        const role = m.role === 'assistant' ? 'model' : 'user';
        contents.push({ role, parts: [{ text: m.content }] });
      }

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json() as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[llm] Gemini SUCCESS`);
          return text;
        }
      }
      const errText = await res.text();
      errors.push(`Gemini failed: HTTP ${res.status} - ${errText}`);
    } catch (err: any) {
      errors.push(`Gemini error: ${err.message}`);
    }
  }

  throw new Error(`All LLM providers failed. Errors:\n${errors.join('\n')}`);
}
