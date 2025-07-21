require('dotenv').config({ path: '.env.local' });

const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Successfully connected to MongoDB!');
    console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);
    
    // List collections
    const collections = await mongoose.connection.db.collections();
    console.log(`\nFound ${collections.length} collections:`);
    collections.forEach(col => console.log(`  - ${col.collectionName}`));
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Connection closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

testConnection();