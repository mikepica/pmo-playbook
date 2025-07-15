import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');
  const type = searchParams.get('type');
  
  if (!filename || !type) {
    return NextResponse.json({ error: 'Missing filename or type parameter' }, { status: 400 });
  }
  
  try {
    if (type === 'markdown') {
      const filePath = path.join(process.cwd(), 'content', 'markdown', filename);
      const content = await readFile(filePath, 'utf8');
      return NextResponse.json({ content });
    } else if (type === 'prompt') {
      const filePath = path.join(process.cwd(), 'content', 'prompts', filename);
      const content = await readFile(filePath, 'utf8');
      const parsed = yaml.load(content) as any;
      return NextResponse.json({ content: parsed });
    }
    
    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}