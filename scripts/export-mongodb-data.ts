import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { connectToDatabase } from '../src/lib/mongodb';
import mongoose from 'mongoose';

async function exportData() {
  try {
    console.log('Connecting to MongoDB...');
    await connectToDatabase();
    
    const exportDir = path.join(__dirname, '..', 'data-export');
    await fs.mkdir(exportDir, { recursive: true });
    
    const collections = [
      'projects',
      'human_sops',
      'agent_sops',
      'chat_histories',
      'user_feedback',
      'message_feedback',
      'change_proposals',
      'sop_version_histories',
      'users'
    ];
    
    console.log(`\nExporting data to: ${exportDir}\n`);
    
    for (const collectionName of collections) {
      console.log(`📦 Exporting ${collectionName}...`);
      
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const documents = await collection.find({}).toArray();
        
        const filePath = path.join(exportDir, `${collectionName}.json`);
        await fs.writeFile(filePath, JSON.stringify(documents, null, 2));
        console.log(`   ✅ Exported ${documents.length} documents`);
      } catch (collectionError) {
        console.log(`   ⚠️  Collection ${collectionName} not found or empty`);
        // Create empty file for consistency
        const filePath = path.join(exportDir, `${collectionName}.json`);
        await fs.writeFile(filePath, JSON.stringify([], null, 2));
      }
    }
    
    // Export collection statistics
    const stats = {};
    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const count = await collection.countDocuments();
        stats[collectionName] = count;
      } catch {
        stats[collectionName] = 0;
      }
    }
    
    await fs.writeFile(
      path.join(exportDir, 'export-stats.json'),
      JSON.stringify(stats, null, 2)
    );
    
    console.log('\n📊 Export Summary:');
    Object.entries(stats).forEach(([collection, count]) => {
      console.log(`   ${collection}: ${count} documents`);
    });
    
    console.log(`\n✅ All data exported successfully!`);
    console.log(`📁 Data saved to: ${exportDir}`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportData();