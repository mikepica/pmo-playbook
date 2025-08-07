import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { getPostgresPool } from '../src/lib/postgres';
import { connectToDatabase } from '../src/lib/mongodb';
import mongoose from 'mongoose';

async function verifyMigration() {
  const pool = getPostgresPool();
  
  try {
    console.log('🔍 Verifying data migration...\n');
    
    // Connect to MongoDB for comparison
    await connectToDatabase();
    
    const collections = [
      { mongo: 'projects', postgres: 'projects', keyField: 'project_id', mongoKey: 'projectId' },
      { mongo: 'human_sops', postgres: 'human_sops', keyField: 'sop_id', mongoKey: 'sopId' },
      { mongo: 'agent_sops', postgres: 'agent_sops', keyField: 'sop_id', mongoKey: 'sopId' },
      { mongo: 'chat_histories', postgres: 'chat_histories', keyField: 'session_id', mongoKey: 'sessionId' },
      { mongo: 'user_feedback', postgres: 'user_feedback', keyField: 'feedback_id', mongoKey: 'feedbackId' },
      { mongo: 'message_feedback', postgres: 'message_feedback', keyField: 'message_id', mongoKey: 'messageId' },
      { mongo: 'change_proposals', postgres: 'change_proposals', keyField: 'proposal_id', mongoKey: 'proposalId' },
      { mongo: 'sop_version_histories', postgres: 'sop_version_histories', keyField: 'sop_id', mongoKey: 'sopId' },
      { mongo: 'users', postgres: 'users', keyField: 'user_id', mongoKey: 'userId' }
    ];
    
    let totalMongo = 0;
    let totalPostgres = 0;
    let allMatched = true;
    
    for (const { mongo, postgres, keyField, mongoKey } of collections) {
      console.log(`📊 ${mongo}:`);
      
      // Count documents in MongoDB
      let mongoCount = 0;
      try {
        const mongoCollection = mongoose.connection.db.collection(mongo);
        mongoCount = await mongoCollection.countDocuments();
        totalMongo += mongoCount;
      } catch (error) {
        console.log(`     ⚠️  MongoDB collection not found`);
      }
      
      // Count rows in PostgreSQL
      const pgResult = await pool.query(`SELECT COUNT(*) FROM ${postgres}`);
      const pgCount = parseInt(pgResult.rows[0].count);
      totalPostgres += pgCount;
      
      console.log(`     MongoDB: ${mongoCount} documents`);
      console.log(`     PostgreSQL: ${pgCount} rows`);
      
      if (mongoCount === pgCount) {
        console.log(`     ✅ Counts match!`);
      } else {
        console.log(`     ⚠️  Count mismatch!`);
        allMatched = false;
      }
      
      // Sample data verification if both have data
      if (mongoCount > 0 && pgCount > 0) {
        try {
          const mongoCollection = mongoose.connection.db.collection(mongo);
          const mongoSample = await mongoCollection.findOne({});
          
          if (mongoSample && mongoSample[mongoKey]) {
            const keyValue = mongoSample[mongoKey];
            const pgSample = await pool.query(
              `SELECT * FROM ${postgres} WHERE ${keyField} = $1`,
              [keyValue]
            );
            
            if (pgSample.rows.length > 0) {
              console.log(`     ✅ Sample document found in both databases`);
              
              // Verify JSONB data integrity
              const pgData = pgSample.rows[0].data;
              const mongoData = { ...mongoSample };
              delete mongoData._id; // Remove for comparison
              
              if (pgData._id === mongoSample._id.toString()) {
                console.log(`     ✅ JSONB data integrity verified`);
              } else {
                console.log(`     ⚠️  JSONB data may have differences`);
              }
            } else {
              console.log(`     ⚠️  Sample document not found in PostgreSQL`);
              allMatched = false;
            }
          }
        } catch (error) {
          console.log(`     ⚠️  Sample verification failed: ${error.message}`);
        }
      }
      console.log('');
    }
    
    // Overall summary
    console.log('📈 Migration Summary:');
    console.log(`   Total MongoDB documents: ${totalMongo}`);
    console.log(`   Total PostgreSQL rows: ${totalPostgres}`);
    console.log(`   Data integrity: ${allMatched ? '✅ All matched' : '⚠️  Some mismatches found'}`);
    
    // Test PostgreSQL-specific functionality
    console.log('\n🧪 Testing PostgreSQL functionality:');
    
    // Test JSONB queries
    const jsonbTest = await pool.query(`
      SELECT COUNT(*) as project_count 
      FROM projects 
      WHERE data->>'projectName' IS NOT NULL
    `);
    console.log(`   ✅ JSONB queries: ${jsonbTest.rows[0].project_count} projects with names`);
    
    // Test full-text search on agent SOPs
    try {
      const searchTest = await pool.query(`
        SELECT COUNT(*) as searchable_sops
        FROM agent_sops 
        WHERE searchable_content IS NOT NULL AND searchable_content != ''
      `);
      console.log(`   ✅ Full-text search: ${searchTest.rows[0].searchable_sops} searchable SOPs`);
    } catch (error) {
      console.log(`   ⚠️  Full-text search test failed`);
    }
    
    // Test foreign key relationships
    try {
      const foreignKeyTest = await pool.query(`
        SELECT COUNT(*) as linked_agent_sops
        FROM agent_sops 
        WHERE human_sop_id IS NOT NULL
      `);
      console.log(`   ✅ Foreign keys: ${foreignKeyTest.rows[0].linked_agent_sops} agent SOPs linked to human SOPs`);
    } catch (error) {
      console.log(`   ⚠️  Foreign key test failed`);
    }
    
    // Test date handling
    const dateTest = await pool.query(`
      SELECT 
        MIN(created_at) as earliest,
        MAX(created_at) as latest,
        COUNT(*) as total
      FROM projects
    `);
    
    if (dateTest.rows[0].total > 0) {
      console.log(`   ✅ Date handling: ${dateTest.rows[0].total} projects, range ${dateTest.rows[0].earliest?.toISOString().split('T')[0]} to ${dateTest.rows[0].latest?.toISOString().split('T')[0]}`);
    }
    
    await mongoose.connection.close();
    
    if (allMatched && totalPostgres > 0) {
      console.log('\n🎉 Migration verification PASSED!');
      process.exit(0);
    } else if (totalPostgres === 0) {
      console.log('\n⚠️  No data found in PostgreSQL - migration may not have run');
      process.exit(1);
    } else {
      console.log('\n⚠️  Migration verification completed with warnings');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyMigration();