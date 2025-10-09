/**
 * Test script to verify page metadata is correctly stored and retrieved
 * Run with: node test-metadata.js
 */

async function testMetadataRetrieval() {
  console.log('🧪 Testing metadata retrieval...\n');

  try {
    // Test 1: Query the API
    console.log('1️⃣ Sending test query...');
    const response = await fetch('http://localhost:3000/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What are best practices for menstrual hygiene?',
      }),
    });

    if (!response.ok) {
      console.error('❌ Query failed:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('✅ Query successful!\n');

    // Test 2: Check response structure
    console.log('2️⃣ Checking response structure...');
    console.log('Answer preview:', data.answer.substring(0, 100) + '...\n');

    // Test 3: Verify sources have page numbers
    console.log('3️⃣ Verifying sources with page numbers:');
    if (data.sources && Object.keys(data.sources).length > 0) {
      console.log('✅ Sources found!\n');
      console.log(JSON.stringify(data.sources, null, 2));

      // Check if pages are numbers
      let allPagesValid = true;
      for (const [filename, pages] of Object.entries(data.sources)) {
        console.log(`\n📄 ${filename}:`);
        if (Array.isArray(pages) && pages.length > 0) {
          const allNumbers = pages.every(p => typeof p === 'number');
          if (allNumbers) {
            console.log(`   ✅ Pages: ${pages.join(', ')} (all are numbers)`);
          } else {
            console.log(`   ❌ Pages: ${pages.join(', ')} (NOT all numbers)`);
            allPagesValid = false;
          }
        } else {
          console.log(`   ⚠️ No pages found`);
          allPagesValid = false;
        }
      }

      if (allPagesValid) {
        console.log('\n🎉 SUCCESS: All page numbers are properly retrieved as numbers!');
      } else {
        console.log('\n❌ FAILED: Some page numbers are missing or invalid.');
        console.log('💡 You may need to rebuild embeddings: POST /api/documents/rebuild-embeddings');
      }
    } else {
      console.log('❌ No sources found in response');
      console.log('💡 This might mean:');
      console.log('   1. No documents in vector database');
      console.log('   2. Metadata not properly stored');
      console.log('   3. Need to rebuild embeddings');
    }

    console.log('\n📊 Full Response:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Server is running (npm run dev)');
    console.log('   2. Vector database is initialized');
    console.log('   3. PDF documents are uploaded');
  }
}

// Run the test
testMetadataRetrieval();
