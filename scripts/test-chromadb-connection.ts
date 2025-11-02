#!/usr/bin/env tsx
/**
 * Diagnostic script to test ChromaDB Cloud connection
 * Run with: npx tsx test-chromadb-connection.ts
 */

import { CloudClient } from 'chromadb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('🔍 ChromaDB Cloud Connection Diagnostic\n');

  // Check environment variables
  const apiKey = process.env.CHROMADB_API_KEY;
  const tenant = process.env.CHROMADB_TENANT;
  const database = process.env.CHROMADB_DATABASE;

  console.log('1. Checking environment variables...');
  const missing: string[] = [];

  if (!apiKey) missing.push('CHROMADB_API_KEY');
  if (!tenant) missing.push('CHROMADB_TENANT');
  if (!database) missing.push('CHROMADB_DATABASE');

  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    console.log('\nPlease check your .env file and ensure these variables are set.');
    process.exit(1);
  }

  console.log('✅ All required environment variables are set');
  console.log(`   Tenant: ${tenant}`);
  console.log(`   Database: ${database}`);
  console.log(`   API Key: ${apiKey?.substring(0, 10)}...`);

  // Test connection
  console.log('\n2. Testing connection to ChromaDB Cloud...');
  try {
    const client = new CloudClient({
      apiKey: apiKey!,
      tenant: tenant!,
      database: database!
    });

    console.log('   Creating client instance... ✅');

    // Try to list collections (this will fail if credentials are invalid)
    console.log('   Testing API access...');
    const collections = await client.listCollections();
    console.log('✅ Successfully connected to ChromaDB Cloud!');
    console.log(`   Found ${collections.length} collection(s):`);

    for (const collection of collections) {
      console.log(`   - ${collection.name}`);
    }

    // Try to get the health_docs collection if it exists
    const healthDocsCollection = collections.find(c => c.name === 'health_docs');
    if (healthDocsCollection) {
      console.log('\n3. Checking health_docs collection...');
      const collection = await client.getCollection({ name: 'health_docs' });
      const count = await collection.count();
      console.log(`✅ health_docs collection has ${count} documents`);
    } else {
      console.log('\nℹ️  health_docs collection does not exist yet (this is normal for a new setup)');
    }

    console.log('\n✅ All tests passed! Your ChromaDB Cloud connection is working properly.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection test failed!');

    if (error instanceof Error) {
      console.error('\nError details:');
      console.error(error.message);

      if (error.message.includes('401') || error.message.includes('authentication')) {
        console.log('\n💡 This looks like an authentication error. Please verify:');
        console.log('   1. Your API key is correct and not expired');
        console.log('   2. The tenant and database names match your ChromaDB Cloud setup');
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        console.log('\n💡 This looks like a network connectivity issue. Please check:');
        console.log('   1. Your internet connection is working');
        console.log('   2. You can reach ChromaDB Cloud service');
        console.log('   3. No firewall is blocking the connection');
      } else if (error.message.includes('404')) {
        console.log('\n💡 This looks like a resource not found error. Please verify:');
        console.log('   1. The tenant name is correct');
        console.log('   2. The database exists in your ChromaDB Cloud account');
      }
    } else {
      console.error('Unknown error:', error);
    }

    console.log('\n📚 For more help, visit: https://docs.trychroma.com/cloud');
    process.exit(1);
  }
}

testConnection();
