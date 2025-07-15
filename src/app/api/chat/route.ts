import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { readFile } from 'fs/promises';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { message, files, isPrompt } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    let context = '';
    
    // Load markdown files for context
    if (files && files.length > 0) {
      const fileContents = await Promise.all(
        files.map(async (filename: string) => {
          try {
            const filePath = path.join(process.cwd(), 'content', 'markdown', filename);
            const content = await readFile(filePath, 'utf8');
            return `--- ${filename} ---\n${content}\n`;
          } catch (error) {
            console.error(`Failed to read file ${filename}:`, error);
            return `--- ${filename} ---\nError: Could not read file\n`;
          }
        })
      );
      
      context = fileContents.join('\n');
    }

    // Build the prompt
    const systemPrompt = `You are a helpful AI assistant that can analyze and discuss the provided markdown documents. ${
      context ? `Here are the documents for reference:\n\n${context}` : 'No documents have been provided.'
    }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || 'No response generated';

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process chat request' 
    }, { status: 500 });
  }
}