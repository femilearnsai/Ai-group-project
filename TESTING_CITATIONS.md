# Testing Dynamic Statutory Citations

## Quick Start

### 1. **Verify Extraction Methods Exist**
```bash
# Check backend/rag/rag_engine.py contains:
# - _extract_all_citations(text: str) method
# - _format_citation(section_type, groups) method
# - These are called in _retrieve_documents()
```

### 2. **Test Basic Citation Extraction**

**Question**: "What is the PIT threshold?"

**Expected Flow**:
1. RAG retrieves documents with section 55 content
2. `_extract_all_citations()` finds "s. 55", "s. 55(1)", "s. 55(2)" in document
3. Metadata shows page 15 for these sections
4. Citation formatted as: `s. 55(1), Nigeria Tax Act 2025 (p. 15)`
5. LLM includes this in response with inline placement
6. Response sources show:
   ```json
   {
       "act_name": "Nigeria Tax Act 2025",
       "section": "s. 55",
       "page": "15",
       "sections_in_content": ["s. 55", "s. 55(1)", "s. 55(2)"],
       "full_citation": "s. 55(1), Nigeria Tax Act 2025 (p. 15)"
   }
   ```

### 3. **Test Multiple Citations**

**Question**: "What are the tax rates and thresholds?"

**Expected Output**:
- Multiple sections cited: s. 55, s. 56, s. 12, etc.
- Each with page number: (p. 15), (p. 16), (p. 8)
- Inline placement in response
- All listed in "Statutory References" section

### 4. **Test Schedule/Part References**

**Question**: "What is the tax rate schedule?"

**Expected Output**:
- Should cite Schedule 1 or Part II
- Format: `Schedule 1, Nigeria Tax Act 2025 (p. 42)`
- Show all sections found in that schedule

### 5. **Test No-Citation Scenario**

**Question**: "How should I plan my tax strategy?"

**Expected Output**:
- Few or no citations (general advice, not specific legal provisions)
- Only cites when directly referencing statutory text
- No invented citations

## Validation Checklist

### Backend Validation
- [ ] `_extract_all_citations()` correctly identifies sections
- [ ] `_format_citation()` outputs "s. X(Y)" format
- [ ] `_retrieve_documents()` enriches sources with sections_in_content
- [ ] System prompt includes citation rules (look for "DYNAMIC CITATION RULES" section)
- [ ] No errors in rag_engine.py (run `python -m py_compile backend/rag/rag_engine.py`)

### API Response Validation
Test the `/chat` endpoint and verify response has:
```json
{
    "response": "...",
    "sources": [
        {
            "source_file": "...",
            "act_name": "...",
            "page": "...",
            "section": "...",
            "sections_in_content": ["..."],
            "full_citation": "s. X, Act (p. Y)"
        }
    ],
    "thinking": "..."
}
```

### Frontend Validation
- [ ] MessageBubble displays response with inline citations
- [ ] SourceCards show citation information
- [ ] No errors in browser console
- [ ] Page numbers display correctly

## Test Commands

### Python Syntax Check
```bash
cd backend
python -m py_compile rag/rag_engine.py
```

### Test Citation Extraction Directly
```python
# In Python terminal:
from rag.rag_engine import RAGEngine
engine = RAGEngine()

# Test _format_citation
result = engine._format_citation("Section", {"number": "55", "subsection": "1"})
print(result)  # Should output: s. 55(1)

# Test _extract_all_citations with sample text
text = "The PIT threshold under Section 55(1) is ₦800,000"
citations = engine._extract_all_citations(text)
print(citations)  # Should extract section 55 with subsection 1
```

### Test Full Chat Response
```bash
# Send test request to backend
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the PIT threshold?",
    "role": "taxpayer",
    "language": "english",
    "session_id": "test-123"
  }'
```

Expected response includes `sources` array with `full_citation` fields.

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| No sections extracted | Check if document contains "Section X" text pattern |
| Page number missing | Verify PDF metadata includes page information |
| Citation format wrong | Ensure `_format_citation()` called from `_extract_all_citations()` |
| Inline citations not in response | Check system prompt for citation placement rules |
| Multiple same citations | Implement deduplication in `_retrieve_documents()` |

## Debugging Tips

### 1. **Check Regex Patterns**
```python
import re
pattern = r'Section\s+(\d+)(?:\s*\(\s*(\d+)\s*\))?'
text = "Section 55(1) of the Act"
match = re.search(pattern, text, re.IGNORECASE)
print(match.groups())  # Should be ('55', '1')
```

### 2. **Print Extraction Steps**
Add logging to `_extract_all_citations()`:
```python
print(f"Found {len(citations)} citations in document")
for cite in citations:
    print(f"  - {cite['formatted']}")
```

### 3. **Verify Document Retrieval**
Check that `_retrieve_documents()` is being called:
```python
# Add to state trace
print(f"Retrieved {len(state.sources)} documents")
for source in state.sources:
    print(f"  - {source.get('full_citation')}")
```

## Success Indicators

✅ **Extraction Working**
- Sections like "55(1)" are extracted as individual citations
- Schedules, Parts, Chapters are recognized

✅ **Formatting Working**
- Format is exactly `s. X(Y), Act (p. Z)`
- No extra spaces or different punctuation

✅ **System Prompt Working**
- Response includes inline citations like "(s. 55(1), Nigeria Tax Act 2025, p. 15)"
- Not just at end of response

✅ **Frontend Working**
- Sources array displays in SourceCards component
- No console errors
- Citation text is readable

## Example Response

**Question**: "What is PIT threshold for self-employed individuals?"

**Expected Response**:
```
For self-employed individuals, the Personal Income Tax (PIT) threshold is 
₦800,000 annually (s. 55(1), Nigeria Tax Act 2025, p. 15). This applies to 
all resident individuals earning from any source, including business income 
(s. 55(2), Nigeria Tax Act 2025, p. 15). Self-employed persons must register 
with the tax authority and maintain business records (s. 21, Nigeria Tax Act 
2025, p. 10).

**📚 Statutory References:**
1. s. 55, Nigeria Tax Act 2025 (p. 15) [Found: s. 55, s. 55(1), s. 55(2)]
2. s. 21, Nigeria Tax Act 2025 (p. 10)
```

---

**Running Tests**: Use curl commands or the frontend interface to verify behavior.
**Reporting Issues**: Check backend logs and browser console for error messages.
**Performance**: Each chat should include <2 seconds for citation extraction overhead.
