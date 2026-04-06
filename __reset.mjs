import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'

config({ path: '.env.local' })
const sql = neon(process.env.DATABASE_URL)

async function main() {
  await sql`UPDATE raw_repos SET processed = false`
  console.log('Reset processed flag')
  await sql`DELETE FROM events`
  console.log('Cleared events')
}
main().catch(console.error).then(() => process.exit(0))
