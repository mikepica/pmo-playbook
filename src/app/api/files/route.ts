import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  
  try {
    if (type === 'markdown') {
      const markdownDir = path.join(process.cwd(), 'content', 'markdown');
      const files = await readdir(markdownDir);
      const markdownFiles = files.filter(file => file.endsWith('.md'));
      return NextResponse.json({ files: markdownFiles });
    } else if (type === 'prompts') {
      const promptsDir = path.join(process.cwd(), 'content', 'prompts');
      const files = await readdir(promptsDir);
      const promptFiles = files.filter(file => file.endsWith('.yaml'));
      return NextResponse.json({ files: promptFiles });
    }
    
    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read files' }, { status: 500 });
  }
}