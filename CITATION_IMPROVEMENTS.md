# Citation Output Improvements

**Date**: 2025-10-05
**Purpose**: Make citations informative without revealing server setup details

## 🔒 Security Improvements

### Before
```json
{
  "answer": "...",
  "sources": {
    "/home/nghiaph/nghiaph_workspace/vinuni/Rag-ChatBot/data/docs/womens_health.pdf": [1, 5, 12],
    "/home/nghiaph/nghiaph_workspace/vinuni/Rag-ChatBot/data/docs/pregnancy_guide.pdf": [3, 7]
  }
}
```

**Issues**:
- ❌ Exposes full server path
- ❌ Reveals username (`nghiaph`)
- ❌ Shows internal directory structure
- ❌ Security risk - provides system reconnaissance info to attackers

### After
```json
{
  "answer": "...",
  "sources": {
    "womens_health.pdf": [1, 5, 12],
    "pregnancy_guide.pdf": [3, 7]
  }
}
```

**Benefits**:
- ✅ Shows only filename (user-friendly)
- ✅ Hides server structure
- ✅ Page numbers sorted in ascending order
- ✅ No internal paths exposed

## 📝 Changes Made

### 1. **Updated Citation Extraction** (`src/lib/chatbot.ts`)

**What changed**: Modified source metadata extraction to use only filenames

```typescript
// Extract only the filename from the full path for security
const filename = sourcePath.split('/').pop() || sourcePath;
```

**Benefits**:
- Strips `/home/nghiaph/.../data/docs/` → keeps only `document.pdf`
- Prevents server path disclosure
- Page numbers are deduplicated and sorted

### 2. **Enhanced Type Definitions** (`src/lib/types.ts`)

**Added**:
- `CitationSchema` for structured citation data
- Optional fields for future enhancements:
  - `relevance_score`: How relevant the source is to the query
  - `excerpt`: Short snippet from the source document

**Example enhanced citation** (future):
```typescript
{
  filename: "womens_health.pdf",
  pages: [1, 5, 12],
  relevance_score: 0.92,
  excerpt: "The menstrual cycle typically lasts..."
}
```

### 3. **Added Formatting Helper** (`src/lib/chatbot.ts`)

**New function**: `formatCitations()`

```typescript
formatCitations({
  "womens_health.pdf": [1, 5, 12],
  "pregnancy_guide.pdf": [3]
})
// Returns: "womens_health.pdf (pages 1, 5, 12); pregnancy_guide.pdf (page 3)"
```

**Usage**: Use this in your frontend/API to display citations in a readable format

### 4. **Fixed Logging** (`src/app/api/documents/upload/route.ts`)

**Before**: `console.log(\`Saving file to: ${filePath}\`)`
**After**: `console.log(\`Uploading file: ${file.name}\`)`

**Why**: Server logs should not expose internal paths

## 🚀 How to Use

### In Your API Response

The API now returns clean citations automatically:

```typescript
// POST /api/query
{
  "question": "What are symptoms of PCOS?",
  "session_id": "abc-123"
}

// Response
{
  "answer": "Polycystic Ovary Syndrome (PCOS) symptoms include...",
  "session_id": "abc-123",
  "sources": {
    "hormone_disorders.pdf": [15, 16, 17],
    "womens_health_guide.pdf": [42]
  }
}
```

### In Your Frontend (Example)

```typescript
import { formatCitations } from '@/lib/chatbot';

// Display formatted citations
const citationText = formatCitations(response.sources);
console.log(citationText);
// Output: "hormone_disorders.pdf (pages 15, 16, 17); womens_health_guide.pdf (page 42)"

// Or display as a list
{Object.entries(response.sources).map(([filename, pages]) => (
  <div key={filename} className="citation">
    <strong>{filename}</strong>
    <span> - Pages: {pages.join(', ')}</span>
  </div>
))}
```

## 🎨 Display Recommendations

### Option 1: Inline Citations
```
Answer: Based on the medical literature, PCOS symptoms include irregular periods...

📚 Sources: hormone_disorders.pdf (pages 15-17), womens_health_guide.pdf (page 42)
```

### Option 2: Numbered References
```
Answer: PCOS symptoms include irregular periods [1], excess hair growth [1],
and weight gain [2].

References:
[1] hormone_disorders.pdf, pages 15-17
[2] womens_health_guide.pdf, page 42
```

### Option 3: Expandable Section
```
Answer: PCOS symptoms include...

[View Sources ▼]
  📄 hormone_disorders.pdf
     Pages: 15, 16, 17

  📄 womens_health_guide.pdf
     Page: 42
```

## 🔮 Future Enhancements

The type system now supports these future features:

1. **Relevance Scores**
   ```json
   {
     "filename": "womens_health.pdf",
     "pages": [1, 5],
     "relevance_score": 0.92
   }
   ```
   Show users which sources are most relevant

2. **Text Excerpts**
   ```json
   {
     "filename": "womens_health.pdf",
     "pages": [5],
     "excerpt": "The menstrual cycle typically lasts 28 days..."
   }
   ```
   Preview the actual content cited

3. **Document Metadata**
   - Publication date
   - Author
   - Document type (guideline, research paper, etc.)

## ✅ Security Checklist

- [x] Remove full file paths from API responses
- [x] Remove full paths from console logs
- [x] Sort page numbers for consistency
- [x] Deduplicate page numbers
- [x] Add type safety for citation format
- [x] Document citation format for frontend developers

## 📚 Related Files

- `src/lib/chatbot.ts` - Citation extraction and formatting
- `src/lib/types.ts` - TypeScript types and Zod schemas
- `src/app/api/query/route.ts` - Query API endpoint
- `src/app/api/documents/upload/route.ts` - Fixed logging

## 🧪 Testing

Test the API:
```bash
# Make a query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is PCOS?"}'

# Response should show clean filenames only
{
  "answer": "...",
  "sources": {
    "document.pdf": [1, 2, 3]
  }
}
```

## 📖 Best Practices

1. **Never log full paths** in production
2. **Sanitize all file-related outputs** before sending to clients
3. **Use environment-agnostic paths** (filenames only)
4. **Sort and deduplicate** citation data for consistency
5. **Consider adding metadata** for richer citations

---

**Note**: All changes are backward compatible. Existing API clients will continue to work with the new citation format.
