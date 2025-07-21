import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

import { connectToDatabase } from '../src/lib/mongodb'

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...')
    const mongoose = await connectToDatabase()
    console.log('✅ Successfully connected to MongoDB!')
    console.log(`Connected to database: ${mongoose.connection.db?.databaseName}`)
    
    // List collections
    const collections = await mongoose.connection.db?.collections()
    console.log(`\nFound ${collections?.length || 0} collections:`)
    collections?.forEach(col => console.log(`  - ${col.collectionName}`))
    
    // Close connection
    await mongoose.connection.close()
    console.log('\n✅ Connection closed successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error)
    process.exit(1)
  }
}

testConnection()