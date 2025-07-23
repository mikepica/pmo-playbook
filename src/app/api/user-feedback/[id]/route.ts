import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import UserFeedback from '@/models/UserFeedback';
import OpenAI from 'openai';

// GET individual feedback
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const feedback = await UserFeedback.findOne({ 
      $or: [
        { feedbackId: params.id },
        { _id: params.id }
      ]
    });

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }

    // Generate AI suggestion if not already present
    if (!feedback.aiSuggestion && process.env.OPENAI_API_KEY) {
      try {
        const aiSuggestion = await generateAISuggestion(feedback);
        feedback.aiSuggestion = aiSuggestion;
        await feedback.save();
      } catch (error) {
        console.warn('Failed to generate AI suggestion:', error);
        // Continue without AI suggestion
      }
    }

    return NextResponse.json({ feedback });

  } catch (error: unknown) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}

// PATCH update feedback status, priority, or add admin notes
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, priority, adminNotes } = body;

    await connectToDatabase();

    const updateFields: Record<string, unknown> = {};
    if (status) updateFields.status = status;
    if (priority) updateFields.priority = priority;
    if (adminNotes !== undefined) updateFields.adminNotes = adminNotes;
    
    const feedback = await UserFeedback.findOneAndUpdate(
      { 
        $or: [
          { feedbackId: params.id },
          { _id: params.id }
        ]
      },
      updateFields,
      { new: true }
    );

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      feedback,
      message: 'Feedback updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to update feedback' },
      { status: 500 }
    );
  }
}

// DELETE feedback (soft delete by setting status to closed)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const feedback = await UserFeedback.findOneAndUpdate(
      { 
        $or: [
          { feedbackId: params.id },
          { _id: params.id }
        ]
      },
      { status: 'closed', adminNotes: 'Feedback deleted by admin' },
      { new: true }
    );

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'Feedback closed successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to delete feedback' },
      { status: 500 }
    );
  }
}

// Helper function to generate AI suggestion for feedback
async function generateAISuggestion(feedback: any) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `You are a PMO expert reviewing user feedback about a Standard Operating Procedure (SOP).

User's Original Question: "${feedback.userQuestion}"

AI's Response: "${feedback.aiResponse}"

User's Feedback: "${feedback.userComment}"

SOP Context:
- SOP ID: ${feedback.sopId}
- SOP Title: ${feedback.sopTitle}
- AI Confidence: ${Math.round(feedback.confidence * 100)}%

Based on this feedback, suggest specific improvements to the SOP that would address the user's concern. Focus on what content should be added, clarified, or expanded.

Respond in JSON format:
{
  "content": "Specific improvement suggestion",
  "rationale": "Why this change would help address the user's concern"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a PMO expert analyzing user feedback to suggest SOP improvements. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    // Clean and parse JSON
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Error generating AI suggestion:', error);
    return null;
  }
}