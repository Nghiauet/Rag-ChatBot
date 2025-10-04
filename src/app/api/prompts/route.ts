import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { PROMPTS_FILE } from '@/lib/config';
import { PromptConfigSchema, PromptUpdateRequestSchema } from '@/lib/types';

/**
 * GET /api/prompts
 * Get current prompt configuration
 */
export async function GET() {
  console.log('Getting prompt configuration...');

  try {
    const fileContents = await fs.readFile(PROMPTS_FILE, 'utf8');
    const prompts = yaml.load(fileContents);

    console.log('Prompt configuration loaded successfully');

    const validatedPrompts = PromptConfigSchema.parse(prompts);
    return NextResponse.json(validatedPrompts);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error('Prompts configuration file not found');
      return NextResponse.json(
        { error: 'Prompts configuration file not found' },
        { status: 404 }
      );
    }

    console.error('Error reading prompts:', error);
    return NextResponse.json(
      { error: `Error reading prompts: ${error}` },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/prompts
 * Update prompt configuration
 */
export async function PUT(request: NextRequest) {
  console.log('Updating prompt configuration...');

  try {
    const body = await request.json();

    // Validate request body
    const validationResult = PromptUpdateRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error },
        { status: 400 }
      );
    }

    const { prompts } = validationResult.data;

    // Convert to YAML and save
    const yamlString = yaml.dump(prompts, {
      flowLevel: -1,
      noRefs: true,
    });

    await fs.writeFile(PROMPTS_FILE, yamlString, 'utf8');
    console.log('Prompt configuration updated successfully');

    return NextResponse.json({ message: 'Prompts updated successfully' });
  } catch (error) {
    console.error('Error updating prompts:', error);
    return NextResponse.json(
      { error: `Error updating prompts: ${error}` },
      { status: 500 }
    );
  }
}
