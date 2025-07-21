import { MongoClient } from 'mongodb'
import mongoose from 'mongoose'

let client: MongoClient | undefined
let clientPromise: Promise<MongoClient> | undefined

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongoose: MongooseCache | undefined
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI
  
  if (!MONGODB_URI) {
    throw new Error('Please add your MongoDB URI to .env.local')
  }
  
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

// MongoDB client for direct operations
export function getMongoClient(): Promise<MongoClient> {
  const MONGODB_URI = process.env.MONGODB_URI
  
  if (!MONGODB_URI) {
    throw new Error('Please add your MongoDB URI to .env.local')
  }

  if (clientPromise) {
    return clientPromise
  }

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable
    if (!global._mongoClientPromise) {
      client = new MongoClient(MONGODB_URI)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    // In production mode, it's best to not use a global variable
    client = new MongoClient(MONGODB_URI)
    clientPromise = client.connect()
  }

  return clientPromise
}

export default getMongoClient