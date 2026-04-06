import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

const hackathonSchema = z.object({
  hackathon_name: z.string().nullable(),
  organizer: z.string().nullable(),
  ecosystem: z.string().nullable(),       // e.g. ethereum, solana, base
  event_type: z.enum([
    'hackathon', 'grant', 'accelerator',
    'builder_program', 'bounty', 'unknown',
  ]).default('hackathon'),
  description: z.string().nullable(),     // one-liner summary of what the project/hackathon is
  prize_pool: z.string().nullable(),      // e.g. "$50,000" if mentioned
  deadline: z.string().nullable(),        // YYYY-MM-DD if mentioned, otherwise null
  official_url: z.string().nullable(),    // only if a direct event URL exists in README
  confidence: z.enum(['high', 'medium', 'low']),
})

export type HackathonExtraction = z.infer<typeof hackathonSchema>

export async function extractHackathonInfo(readmeContent: string): Promise<HackathonExtraction | null> {
  // Already truncated upstream, but guard here too
  const truncated = readmeContent.slice(0, 3000)

  try {
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: hackathonSchema,
      prompt: `
You are extracting hackathon and builder program information from a GitHub README.

Most READMEs will only mention the hackathon name and little else.
That is fine — the hackathon name is the most important field.

Extract whatever is present. Do not invent or guess fields that are not mentioned.
If you cannot find a hackathon name at all, return null for hackathon_name.

Confidence rules:
- high: hackathon name is clearly and explicitly stated
- medium: hackathon name is implied or partially mentioned
- low: only a vague reference exists

README:
${truncated}
      `,
    })

    return object
  } catch (err) {
    console.error('[extract] Gemini extraction failed:', err)
    return null
  }
}
