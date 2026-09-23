import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return Response.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = '';

    if (name.endsWith('.pdf')) {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text: extracted } = await extractText(pdf, { mergePages: true });
      text = Array.isArray(extracted) ? extracted.join('\n') : extracted;
    } else if (name.endsWith('.docx')) {
      const { value } = await mammoth.extractRawText({ buffer });
      text = value;
    } else if (name.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else {
      return Response.json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' }, { status: 400 });
    }

    text = text.replace(/\n{3,}/g, '\n\n').trim();

    if (!text) {
      return Response.json({ error: 'Could not extract any text from this file.' }, { status: 422 });
    }

    return Response.json({ text });
  } catch (error) {
    console.error('[extract] error:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Failed to read the file.' }, { status: 500 });
  }
}
