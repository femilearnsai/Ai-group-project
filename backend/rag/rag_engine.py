"""
Nigerian Tax Reform Bills Document Question Answering
Uses LangChain for document processing and LangGraph for agentic retrieval
"""

from typing import List, Dict, Any, TypedDict, Annotated, cast, Optional
from pathlib import Path
from datetime import datetime
import re

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableConfig

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class ConversationState(TypedDict):
    """State for the conversation agent"""
    messages: Annotated[List[BaseMessage], "The conversation messages"]
    context: Annotated[str, "Retrieved context from documents"]
    sources: Annotated[List[Dict[str, Any]], "Source documents with citations"]
    needs_retrieval: Annotated[bool, "Whether retrieval is needed"]
    user_role: Annotated[str, "The user's role: tax_lawyer, taxpayer, or company"]
    detected_language: Annotated[str, "The detected language of the user's message"]


# Role-based response instructions
ROLE_PROMPTS = {
    "tax_lawyer": """### 🎭 RESPONSE STYLE: TAX LAWYER MODE
You are responding to a **Tax Lawyer/Legal Professional**.

**Communication Style:**
- Use formal, precise legal language
- Reference specific statutory provisions with exact section numbers
- Use legal terminology (e.g., "pursuant to", "notwithstanding", "in accordance with")
- Structure responses like legal opinions or memoranda
- Cite primary sources: Acts, Regulations, Case Law, FIRS Circulars
- Include relevant legal precedents where applicable
- Use formal salutations and sign-offs
- Analyze legal implications and potential interpretations
- Highlight areas of ambiguity or conflicting provisions
- Present information in structured legal format with numbered paragraphs

**Example Tone:**
"Pursuant to Section 55(1) of the Nigeria Tax Act 2025, it is provided that..."
"In construing the provisions of the Act, regard must be had to..."
"The legal position as stated under the extant legislation is as follows..."
""",

    "taxpayer": """### 🎭 RESPONSE STYLE: TAXPAYER MODE
You are responding to an **Individual Taxpayer** (employee, self-employed, or small business owner).

**Communication Style:**
- Use casual, friendly, conversational language
- Explain complex tax concepts in simple terms
- Use practical, everyday examples to illustrate points
- Avoid excessive legal jargon - if used, explain it immediately
- Be empathetic and understanding about tax concerns
- Use analogies and relatable scenarios
- Break down calculations step-by-step with clear explanations
- Offer practical tips and common mistakes to avoid
- Use encouraging language

**Example Tone:**
"Great question! Let me break this down for you..."
"Think of it like this - imagine you earn ₦500,000 monthly..."
"Don't worry, this is simpler than it sounds. Here's what you need to know..."
"A common mistake many people make is... Here's how to avoid it..."
""",

    "company": """### 🎭 RESPONSE STYLE: COMPANY/COMPLIANCE OFFICER MODE
You are responding as a **Corporate Tax Compliance Desk/Officer** to a company representative.

**Communication Style:**
- Professional, business-oriented communication
- Focus on compliance requirements, deadlines, and procedures
- Provide actionable checklists and compliance steps
- Reference filing requirements, forms, and documentation needed
- Highlight penalties for non-compliance and risk mitigation
- Use corporate/business terminology
- Structure responses as compliance guidance or advisory notes
- Include timelines, due dates, and procedural requirements
- Mention record-keeping obligations
- Address audit preparedness and documentation

**Example Tone:**
"For corporate compliance purposes, your organization should note the following..."
"The filing requirements under the Act are as follows..."
"To ensure full compliance, please action the following items by the stated deadlines..."
"Your compliance checklist should include: 1) ... 2) ... 3) ..."
"""
}


class RAGEngine:
    """
    Intelligent RAG engine that:
    - Loads and processes policy documents
    - Creates vector database for semantic search
    - Uses an agent to decide WHEN to retrieve documents
    - Maintains conversation context
    - Cites sources in answers
    """

    def __init__(self, docs_path: Optional[str] = None, persist_directory: Optional[str] = None):
        """
        Initialize the RAG engine

        Args:
            docs_path: Path to the documents directory
            persist_directory: Path to persist the vector database
        """
        if docs_path is None:
            docs_path = str(Path(__file__).parent / "docs")
        if persist_directory is None:
            persist_directory = str(Path(__file__).parent / "chroma_db")

        self.docs_path = docs_path
        self.persist_directory = persist_directory

        # Initialize LLM and embeddings
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        self.embeddings = OpenAIEmbeddings()

        # Initialize vector store
        self.vectorstore: Optional[Chroma] = None
        self.retriever: Optional[VectorStoreRetriever] = None

        # Initialize the agent graph
        self.app: Any = None
        self.memory = MemorySaver()

    def _extract_section(self, text: str) -> str:
        """
        Extract section number from document text content.
        Looks for patterns like 'Section 1', 's. 5', 'Part II', 'Schedule 3', etc.
        """
        # Common section patterns in Nigerian legislation
        patterns = [
            # "Section 1", "Section 55(1)", "Section 12(2)(a)"
            r'[Ss]ection\s+(\d+(?:\(\d+\))?(?:\([a-z]\))?)',
            # "s. 1", "s.55(1)", "s. 12(2)(a)"
            r'[Ss]\.\s*(\d+(?:\(\d+\))?(?:\([a-z]\))?)',
            # "Part I", "Part II", "Part III"
            r'[Pp]art\s+([IVXLCDM]+|\d+)',
            # "Schedule 1", "First Schedule", "Third Schedule"
            r'(?:[Ff]irst|[Ss]econd|[Tt]hird|[Ff]ourth|[Ff]ifth)?\s*[Ss]chedule\s*(\d*)',
            # "Chapter 1", "Chapter II"
            r'[Cc]hapter\s+([IVXLCDM]+|\d+)',
            # "Article 1", "Article 5"
            r'[Aa]rticle\s+(\d+)',
            # "Regulation 1", "Regulation 15"
            r'[Rr]egulation\s+(\d+)',
        ]
        
        sections_found = []
        
        for pattern in patterns:
            matches = re.findall(pattern, text[:500])  # Check first 500 chars
            for match in matches:
                if 'Section' in pattern or 's.' in pattern.lower():
                    sections_found.append(f"s. {match}")
                elif 'Part' in pattern:
                    sections_found.append(f"Part {match}")
                elif 'Schedule' in pattern:
                    sections_found.append(f"Schedule {match}" if match else "Schedule")
                elif 'Chapter' in pattern:
                    sections_found.append(f"Chapter {match}")
                elif 'Article' in pattern:
                    sections_found.append(f"Article {match}")
                elif 'Regulation' in pattern:
                    sections_found.append(f"Reg. {match}")
        
        if sections_found:
            # Return unique sections, prioritizing the first found
            seen = set()
            unique = []
            for s in sections_found:
                if s not in seen:
                    seen.add(s)
                    unique.append(s)
            return ", ".join(unique[:3])  # Return up to 3 sections
        
        return "General Provisions"

    def _extract_all_citations(self, text: str) -> List[Dict[str, str]]:
        """
        Extract all section citations from text, returning both section number and context.
        Returns a list of citation dictionaries with section, subsection, and context.
        """
        citations = []
        
        # Patterns with capture groups for comprehensive extraction
        patterns = [
            # "Section X(Y)(Z)" - captures full nested sections
            (r'[Ss]ection\s+(\d+)(?:\((\d+)\))?(?:\(([a-z])\))?', 'Section'),
            # "s. X(Y)(Z)"
            (r'[Ss]\.\s*(\d+)(?:\((\d+)\))?(?:\(([a-z])\))?', 'Section'),
            # "Part Roman numerals"
            (r'[Pp]art\s+([IVXLCDM]+)', 'Part'),
            # "Schedule X"
            (r'(?:[Ff]irst|[Ss]econd|[Tt]hird|[Ff]ourth|[Ff]ifth)?\s*[Ss]chedule\s*(\d*)', 'Schedule'),
            # "Chapter X"
            (r'[Cc]hapter\s+([IVXLCDM]+|\d+)', 'Chapter'),
            # "Article X"
            (r'[Aa]rticle\s+(\d+)', 'Article'),
            # "Regulation X"
            (r'[Rr]egulation\s+(\d+)', 'Regulation'),
        ]
        
        for pattern, section_type in patterns:
            matches = list(re.finditer(pattern, text[:1000]))
            for match in matches:
                citation_dict = {
                    "type": section_type,
                    "number": match.group(1),
                    "subsection": match.group(2) if len(match.groups()) > 1 else None,
                    "subsubsection": match.group(3) if len(match.groups()) > 2 else None,
                    "formatted": self._format_citation(section_type, match.groups()),
                    "start": match.start(),
                    "end": match.end()
                }
                citations.append(citation_dict)
        
        # Sort by position and remove duplicates
        citations.sort(key=lambda x: x['start'])
        seen = set()
        unique_citations = []
        for c in citations:
            key = (c['type'], c['number'], c['subsection'], c['subsubsection'])
            if key not in seen:
                seen.add(key)
                unique_citations.append(c)
        
        return unique_citations
    
    def _format_citation(self, section_type: str, groups: tuple) -> str:
        """Format citation based on type and extracted groups"""
        if section_type == 'Section':
            base = f"s. {groups[0]}"
            if groups[1]:
                base += f"({groups[1]})"
            if len(groups) > 2 and groups[2]:
                base += f"({groups[2]})"
            return base
        elif section_type == 'Part':
            return f"Part {groups[0]}"
        elif section_type == 'Schedule':
            return f"Schedule {groups[0]}" if groups[0] else "Schedule"
        elif section_type == 'Chapter':
            return f"Chapter {groups[0]}"
        elif section_type == 'Article':
            return f"Article {groups[0]}"
        elif section_type == 'Regulation':
            return f"Reg. {groups[0]}"
        return ""

    def load_documents(self) -> List[Document]:
        """Load all PDF documents from the docs directory"""
        documents = []
        docs_dir = Path(self.docs_path)

        if not docs_dir.exists():
            raise ValueError(
                f"Documents directory not found: {self.docs_path}")

        pdf_files = list(docs_dir.glob("*.pdf"))

        if not pdf_files:
            raise ValueError(f"No PDF files found in {self.docs_path}")

        print(f"Loading {len(pdf_files)} PDF documents...")

        for pdf_file in pdf_files:
            print(f"  - Loading {pdf_file.name}")
            loader = PyPDFLoader(str(pdf_file))
            docs = loader.load()

            # Add metadata with section extraction
            for doc in docs:
                doc.metadata["source_file"] = pdf_file.name
                doc.metadata["source_path"] = str(pdf_file)
                # Extract section from content
                doc.metadata["section"] = self._extract_section(doc.page_content)
                
                # Determine Act short name from filename
                filename = pdf_file.name.lower()
                if "tax act" in filename or "nigeria tax" in filename:
                    doc.metadata["act_name"] = "Nigeria Tax Act 2025"
                elif "administration" in filename:
                    doc.metadata["act_name"] = "Nigeria Tax Administration Act 2025"
                elif "revenue service" in filename or "nrs" in filename:
                    doc.metadata["act_name"] = "Nigeria Revenue Service Act 2025"
                elif "joint revenue" in filename or "jrb" in filename:
                    doc.metadata["act_name"] = "Joint Revenue Board Act 2025"
                else:
                    doc.metadata["act_name"] = pdf_file.stem

            documents.extend(docs)

        print(f"Loaded {len(documents)} pages total")
        return documents

    def create_vector_database(self, force_reload: bool = False):
        """
        Create or load the vector database

        Args:
            force_reload: If True, reload documents even if DB exists
        """
        persist_path = Path(self.persist_directory)

        # Check if database exists
        if persist_path.exists() and not force_reload:
            print("Loading existing vector database...")
            self.vectorstore = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings
            )
        else:
            print("Creating new vector database...")

            # Load documents
            documents = self.load_documents()

            # Split documents into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len,
                separators=["\n\n", "\n", " ", ""]
            )

            splits = text_splitter.split_documents(documents)
            print(f"Split into {len(splits)} chunks")

            # Re-extract sections for each chunk (in case split breaks section context)
            for split in splits:
                # If section is missing or generic, try to extract from chunk content
                if split.metadata.get("section", "General Provisions") == "General Provisions":
                    extracted_section = self._extract_section(split.page_content)
                    if extracted_section != "General Provisions":
                        split.metadata["section"] = extracted_section

            # Create vector store
            self.vectorstore = Chroma.from_documents(
                documents=splits,
                embedding=self.embeddings,
                persist_directory=self.persist_directory
            )

            print("Vector database created and persisted")

        # Create retriever
        self.retriever = self.vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4}
        )

    def _should_retrieve(self, state: ConversationState) -> str:
        """
        Agent node: Decide if retrieval is needed based on the conversation
        """
        messages = state["messages"]
        last_msg = messages[-1] if messages else None

        # Create a prompt to decide if retrieval is needed
        decision_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a routing agent. Decide if the user's question requires searching through policy documents.
            
            Answer 'YES' if:
            - The question asks about specific policies, regulations, tax laws, or legal information
            - The question requires factual information from documents
            - The question is about Nigeria Tax Act, Revenue Service, or related legislation
            - The question is about tax or it's benefits, NRS, JRB
            
            Answer 'NO' if:
            - The question is a greeting or general chat
            - The question is a follow-up asking for clarification of previous answer
            - The question is about your capabilities
            
            IMPORTANT — POST-RETRIEVE REQUIREMENT:
            If you choose 'YES', the final legal answer MUST:

            - Cite the specific section(s) relied upon from the relevant Act
            - Use clear section-level citation tags in this format: “See s. [section number], [short Act name]”
            - Attach citations immediately after each legal proposition, rate, obligation, exemption, or definition
            - NEVER cite an Act without a section number
            - NEVER infer or guess section numbers
            - If no section can be confidently identified, state that explicitly
            
            Respond with ONLY 'YES' or 'NO'."""),
            MessagesPlaceholder(variable_name="messages"),
        ])

        chain = decision_prompt | self.llm | StrOutputParser()
        decision = chain.invoke({"messages": messages})

        needs_retrieval = "YES" in decision.upper()

        return "retrieve" if needs_retrieval else "generate"

    def _retrieve_documents(self, state: ConversationState) -> ConversationState:
        """
        Agent node: Retrieve relevant documents from vector store
        Extracts dynamic citations with both sections and pages
        """
        messages = state["messages"]
        last_msg = messages[-1] if messages else None
        last_message = str(last_msg.content) if last_msg else ""

        # Retrieve relevant documents
        if self.retriever is None:
            raise RuntimeError("Retriever not initialized")
        docs = self.retriever.invoke(last_message)

        # Format context with dynamic source citations
        context_parts = []
        sources = []

        for i, doc in enumerate(docs, 1):
            # Get page number from metadata
            page = doc.metadata.get("page", "N/A")
            act_name = doc.metadata.get("act_name", doc.metadata.get("source_file", "Unknown"))
            
            # Extract all citations from document content
            all_citations = self._extract_all_citations(doc.page_content)
            
            # Get primary section
            section = doc.metadata.get("section", "General Provisions")
            
            # Build citation string with both section and page
            if all_citations and section != "General Provisions":
                # Format: "s. 55, Nigeria Tax Act 2025 (p. X)"
                primary_citation = all_citations[0]['formatted']
                citation_str = f"{primary_citation}, {act_name} (p. {page})"
            else:
                citation_str = f"{section}, {act_name} (p. {page})"
            
            # Create comprehensive source info for frontend
            source_info = {
                "source_file": doc.metadata.get("source_file", "Unknown"),
                "act_name": act_name,
                "page": page,
                "section": section,
                "sections_in_content": [c['formatted'] for c in all_citations[:5]],  # Top 5 sections
                "citation": citation_str,
                "full_citation": f"{section}, {act_name}, p. {page}",
                "content_preview": doc.page_content[:200] + "..."
            }
            sources.append(source_info)

            # Format context with section and page info
            context_parts.append(
                f"[Source {i}: {citation_str}]\n{doc.page_content}\n"
            )

        context = "\n---\n".join(context_parts)

        return {
            **state,
            "context": context,
            "sources": sources,
            "needs_retrieval": True
        }

    def _detect_language(self, text: str) -> str:
        """
        Detect the language of user input.
        Default is English - only switches to Nigerian languages when clearly indicated.
        Supports: English (default), Hausa, Igbo, Yoruba, Nigerian Pidgin
        """
        # Strong Hausa indicators (distinct words unlikely in English)
        hausa_indicators = [
            'sannu', 'barka', 'nagode', 'na gode', 'yaya', 'lafiya', 'hakuri',
            'wannan', 'wancan', 'kowane', 'lokacin', 'mutum', 'yara', 'gida'
        ]
        
        # Strong Igbo indicators (distinct words with special characters)
        igbo_indicators = [
            'kedu', 'daalụ', 'biko', 'ndewo', 'ọ dị', 'anyị', 'ụlọ', 'ụbọchị',
            'chọrọ', 'nwere', 'mmadụ', 'ọrụ', 'ụkwụ'
        ]
        
        # Strong Yoruba indicators (words with tonal marks or distinct patterns)
        yoruba_indicators = [
            'báwo', 'ṣe', 'káàbọ̀', 'ẹ káàsán', 'ẹ kúlẹ́', 'dúpẹ́', 'jọ̀wọ́',
            'ọmọ', 'ìyá', 'baba', 'owó', 'iṣẹ́', 'nígbà', 'ènìyàn'
        ]
        
        # Strong Nigerian Pidgin indicators (distinct pidgin expressions)
        pidgin_indicators = [
            'wetin', 'abeg', 'sabi', 'sef', 'sha', 'shey', 'abi',
            'waka', 'pikin', 'oga', 'chop', 'wahala', 'dey do', 'e don',
            'how far', 'how you dey', 'no wahala', 'na so', 'i dey'
        ]
        
        text_lower = text.lower()
        
        # Count matches - require stronger evidence for language switch
        hausa_score = sum(1 for word in hausa_indicators if word in text_lower)
        igbo_score = sum(1 for word in igbo_indicators if word in text_lower)
        yoruba_score = sum(1 for word in yoruba_indicators if word in text_lower)
        pidgin_score = sum(1 for word in pidgin_indicators if word in text_lower)
        
        # Require at least 2 matches OR 1 very strong indicator to switch from English
        # This prevents false positives from common words
        if hausa_score >= 2 or any(word in text_lower for word in ['sannu', 'nagode', 'barka da']):
            return "Hausa"
        elif igbo_score >= 2 or any(word in text_lower for word in ['kedu', 'daalụ', 'ndewo']):
            return "Igbo"
        elif yoruba_score >= 2 or any(word in text_lower for word in ['káàbọ̀', 'báwo ni', 'ẹ ṣé']):
            return "Yoruba"
        elif pidgin_score >= 2 or any(phrase in text_lower for phrase in ['how you dey', 'wetin dey', 'abeg', 'no wahala']):
            return "Nigerian Pidgin"
        
        # Default to English
        return "English"
    
    def _generate_response(self, state: ConversationState) -> ConversationState:
        """
        Agent node: Generate response with or without retrieved context
        Supports multilingual responses in English, Hausa, Igbo, Yoruba, and Nigerian Pidgin
        Adapts tone based on user role: tax_lawyer, taxpayer, or company
        """
        messages = state["messages"]
        context = state.get("context", "")
        sources = state.get("sources", [])
        user_role = state.get("user_role", "taxpayer")  # Default to taxpayer
        
        # Get role-specific prompt
        role_instruction = ROLE_PROMPTS.get(user_role, ROLE_PROMPTS["taxpayer"])
        
        # Use detected language from state if available, otherwise detect from last message
        detected_language = state.get("detected_language", "")
        if not detected_language:
            last_human_msg = next((msg.content for msg in reversed(messages) if isinstance(msg, HumanMessage)), "")
            detected_language = self._detect_language(last_human_msg)
        else:
            last_human_msg = next((msg.content for msg in reversed(messages) if isinstance(msg, HumanMessage)), "")
        
        # Log detected language and role for debugging
        print(f"🌍 Detected language: {detected_language} from message: {last_human_msg[:50]}...")
        print(f"👤 User role: {user_role}")

        if context:
            # Generate answer with context and dynamic citations
            system_message = f"""You are an expert Nigerian Tax AI Agent.

You operate strictly under Nigerian tax laws, including but not limited to:
- Nigeria Tax Act, 2025
- Nigeria Tax Administration Act, 2025
- Nigeria Revenue Service (Establishment) Act, 2025
- Joint Revenue Board of Nigeria (Establishment) Act, 2025
- Relevant Regulations, Circulars, and Subsidiary Legislation

Your role is to:
1. Accurately explain Nigerian taxes applicable to individuals and companies.
2. Calculate taxes based on user inputs.
3. Return structured, developer-friendly outputs suitable for frontend calculators.
4. Cite relevant sections and pages from the documents you consulted.

---

### 🎯 CORE PRINCIPLES
- Always distinguish between **Individuals** and **Companies**
- Respect tax residency, turnover thresholds, and exemptions
- Treat Withholding Tax (WHT) as an **advance tax**, not a final tax (except where expressly stated)
- Use **plain language**, but remain legally precise
- Never invent tax rates or obligations
- If data is insufficient, request clarification

---

### 📚 DYNAMIC CITATION RULES (CRITICAL)
**Citation Format Requirements:**
1. **With Section Number**: Use format `s. [section number], [Act name] (p. [page number])`
   - Example: "s. 55(1), Nigeria Tax Act 2025 (p. 15)"
   - Example: "Schedule 3, Nigeria Tax Act 2025 (p. 42)"

2. **With Page Reference**: Include page number in parentheses
   - Example: "s. 12, Nigeria Tax Administration Act 2025 (p. 8)"

3. **Multiple Related Sections**: Cite all relevant provisions
   - Example: "s. 56(1) and s. 56(2), Nigeria Tax Act 2025 (pp. 15-16)"

4. **When No Section Available**: Use page reference only
   - Format: "[Act name], p. [page number]"

**CITATION PLACEMENT:**
- Place citations **immediately after** the fact or claim they support
- Use inline citations within your answer, not just at the end
- Example: "The standard CIT rate is 30% (s. 12, Nigeria Tax Act 2025, p. 8) for companies with turnover above ₦100 million."

**CITATION ACCURACY:**
- ONLY cite sections and pages that actually appear in the provided context
- NEVER invent section numbers or pages
- NEVER cite without at least a section or page number
- If unsure about a citation, acknowledge the limitation

**INLINE CITATION EXAMPLES:**
- "According to s. 55(1) of the Nigeria Tax Act 2025 (p. 15), the PIT threshold is ₦800,000 annually."
- "Companies earning above ₦100 million are subject to 30% CIT (s. 12, NTA 2025, p. 8)."
- "For withholding tax on consultancy services, see s. 41(2) of the Nigeria Tax Act 2025 (p. 28)."

---

### 📊 TAXES YOU MUST HANDLE

#### For Companies
- Company Income Tax (CIT)
- Withholding Tax (WHT)
- Value Added Tax (VAT)
- Education Tax (where applicable)
- Capital Gains Tax (CGT)
- Tertiary sector or industry-specific levies (if applicable)

#### For Individuals
- Personal Income Tax (PIT)
- Withholding Tax (WHT)
- Capital Gains Tax (CGT)
- Stamp Duties (where relevant)

---

### 📌 STANDARD COMPANY INCOME TAX RATES (DEFAULT LOGIC)

Use turnover-based classification unless user specifies otherwise:

- Small company (₦25m or less): 0%
- Medium company (₦25m – ₦100m): 20%
- Large company (Above ₦100m): 30%

---

### 📌 STANDARD WITHHOLDING TAX LOGIC (DEFAULT)

Apply WHT as an **advance payment** against income tax:

- Dividends / Interest / Rent
- Royalties
- Consultancy / Professional / Technical Services
- Management Services
- Commissions
- Construction / Contracts / Supplies
- Director's Fees

Always:
- Identify payer (company or individual)
- Identify recipient
- Apply correct rate
- Flag creditability against income tax

---

### 🧮 CALCULATOR RESPONSE FORMAT (MANDATORY)

When calculating tax, return results in this structured format with clear sections for calculations, rates, and legal basis.

---

### ⚠️ RESTRICTIONS
- Do NOT provide legal advice outside Nigerian tax law
- Do NOT speculate on unpublished regulations
- Do NOT override statutory thresholds
- Do NOT mix federal and state tax jurisdictions incorrectly

---

### 🧠 BEHAVIOR RULES
- Be deterministic and consistent
- Be conservative where ambiguity exists
- Prefer statutory interpretation over assumptions
- Clearly flag exemptions, reliefs, or incentives
- Cite the actual documents you reviewed

---

{role_instruction}

---

### 🌍 LANGUAGE INSTRUCTION
The user is communicating in {detected_language}. You MUST respond entirely in {detected_language}.
- If {detected_language} is Hausa, respond in Hausa
- If {detected_language} is Igbo, respond in Igbo  
- If {detected_language} is Yoruba, respond in Yoruba
- If {detected_language} is Nigerian Pidgin, respond in Nigerian Pidgin
- If {detected_language} is English, respond in English

Translate technical tax terms appropriately for {detected_language} while maintaining accuracy.

---

### 📚 CONTEXT AND CITATIONS
You have been provided with context from relevant policy documents. Use this context to answer the question accurately. 

**Citation Requirements:**
- Always cite the sections and pages from the provided context
- Use the format: "s. [section], [Act name] (p. [page])"
- Place citations immediately after relevant claims
- Include page numbers in all citations
- For questions answered from context, end with a summary of cited authorities

If the context doesn't contain enough information to answer the question completely, state what information is missing and what you could infer.

You are a compliance-first, statute-driven Nigerian Tax AI."""

            prompt = ChatPromptTemplate.from_messages([
                ("system", system_message),
                ("system", "Context from policy documents:\n\n{context}"),
                MessagesPlaceholder(variable_name="messages"),
            ])

            chain = prompt | self.llm | StrOutputParser()
            response = chain.invoke({
                "context": context,
                "messages": messages
            })

            # Append sources list at the end with comprehensive citations
            if sources:
                response += "\n\n**📚 Statutory References Cited:**\n"
                for i, source in enumerate(sources, 1):
                    # Use full citation with sections and page
                    full_citation = source.get('full_citation', source.get('citation', f"{source['source_file']}, Page {source['page']}"))
                    # Also show individual sections found in the content
                    sections_text = ""
                    if source.get('sections_in_content'):
                        sections_text = f" [Found: {', '.join(source['sections_in_content'])}]"
                    response += f"{i}. {full_citation}{sections_text}\n"

        else:
            # Generate answer without context (for greetings, etc.)
            system_message = f"""You are an expert Nigerian Tax AI Agent.

You operate strictly under Nigerian tax laws, including but not limited to:
- Nigeria Tax Act, 2025
- Nigeria Tax Administration Act, 2025
- Nigeria Revenue Service (Establishment) Act, 2025
- Joint Revenue Board of Nigeria (Establishment) Act, 2025

Your role is to assist with Nigerian tax questions for both individuals and companies.

---

{role_instruction}

---

### 🌍 LANGUAGE INSTRUCTION
The user is communicating in {detected_language}. You MUST respond entirely in {detected_language}.

- If {detected_language} is Hausa, respond in Hausa (e.g., greetings like "Sannu!", "Yaya kuke?")
- If {detected_language} is Igbo, respond in Igbo (e.g., greetings like "Ndewo!", "Kedu ka ị mere?")
- If {detected_language} is Yoruba, respond in Yoruba (e.g., greetings like "Ẹ káàbọ̀!", "Báwo ni?")
- If {detected_language} is Nigerian Pidgin, respond in Nigerian Pidgin (e.g., "How you dey?", "Wetin you wan know?")
- If {detected_language} is English, respond in English

---

### YOUR IDENTITY
You are an expert Nigerian Tax AI Agent specializing in:
- Nigeria Tax Act, 2025
- Nigeria Tax Administration Act, 2025
- Nigeria Revenue Service (Establishment) Act, 2025
- Joint Revenue Board of Nigeria (Establishment) Act, 2025

You help with:
- Personal Income Tax (PIT) for individuals
- Company Income Tax (CIT) for businesses
- Withholding Tax (WHT) calculations
- Value Added Tax (VAT)
- Capital Gains Tax (CGT)
- Tax compliance and statutory interpretations

---

### 🎯 CONVERSATION MODE
You are currently in **general conversation mode** (no document retrieval needed).

- Be warm and culturally appropriate for Nigerian users
- Provide helpful guidance about tax topics
- For specific policy questions or legal details, suggest asking about:
  * Nigeria Tax Act, 2025
  * Nigeria Tax Administration Act, 2025
  * Nigeria Revenue Service (Establishment) Act, 2025
  * Joint Revenue Board of Nigeria (Establishment) Act, 2025

---

### 🌍 LANGUAGE INSTRUCTION
The user is communicating in {detected_language}. You MUST respond entirely in {detected_language}.
- If {detected_language} is Hausa, respond in Hausa (e.g., greetings like "Sannu!", "Yaya kuke?")
- If {detected_language} is Igbo, respond in Igbo (e.g., greetings like "Ndewo!", "Kedu ka ị mere?")
- If {detected_language} is Yoruba, respond in Yoruba (e.g., greetings like "Ẹ káàbọ̀!", "Báwo ni?")
- If {detected_language} is Nigerian Pidgin, respond in Nigerian Pidgin (e.g., "How you dey?", "Wetin you wan know?")
- If {detected_language} is English, respond in English

---

### 🎯 YOUR EXPERTISE
You are an expert Nigerian Tax AI Agent specializing in:
- Nigeria Tax Act, 2025
- Nigeria Tax Administration Act, 2025
- Nigeria Revenue Service (Establishment) Act, 2025
- Joint Revenue Board of Nigeria (Establishment) Act, 2025

You handle:
- Personal Income Tax (PIT) for individuals
- Company Income Tax (CIT) for companies
- Withholding Tax (WHT)
- Value Added Tax (VAT)
- Capital Gains Tax (CGT)
- Education Tax and other applicable levies

Key principles:
- Distinguish between Individuals and Companies
- Treat WHT as advance tax (unless expressly final)
- Use plain language but remain legally precise
- Never invent tax rates or obligations
- Be conservative where ambiguity exists

---

### 📌 STANDARD TAX RATES (DEFAULT LOGIC)

**Company Income Tax (CIT):**
- Small company (₦25m or less): 0%
- Medium company (₦25m – ₦100m): 20%
- Large company (Above ₦100m): 30%

---

### 🏁 FALLBACK
If a user request:
- Lacks sufficient data → Ask for clarification
- Falls outside Nigerian tax law → Politely decline
- Requires computation → Provide structured calculations with legal basis

---

### 🌍 LANGUAGE INSTRUCTION
The user is communicating in {detected_language}. You MUST respond entirely in {detected_language}.
- If {detected_language} is Hausa, respond in Hausa (e.g., greetings like "Sannu!", "Yaya kuke?")
- If {detected_language} is Igbo, respond in Igbo (e.g., greetings like "Ndewo!", "Kedu ka ị mere?")
- If {detected_language} is Yoruba, respond in Yoruba (e.g., greetings like "Ẹ káàbọ̀!", "Báwo ni?")
- If {detected_language} is Nigerian Pidgin, respond in Nigerian Pidgin (e.g., "How you dey?", "Wetin you wan know?")
- If {detected_language} is English, respond in English

Be warm and culturally appropriate for Nigerian users. Guide users toward asking specific questions about:
- Nigeria Tax Act 2025
- Nigeria Tax Administration Act, 2025
- Nigeria Revenue Service (Establishment) Act, 2025
- Joint Revenue Board of Nigeria (Establishment) Act, 2025

When users ask general questions or greet you, respond warmly in {detected_language} and invite them to ask specific tax questions.

Examples of how to respond in different languages:
- Hausa: "Sannu! Ina son in taimake ku game da haraji na Najeriya. Kuna da wata tambaya?"
- Igbo: "Ndewo! Achọrọ m inyere gị aka banyere iwu ụtụ isi nke Naịjirịa. Ị nwere ajụjụ?"
- Yoruba: "Ẹ káàbọ̀! Mo fẹ́ ràn ọ́ lọ́wọ́ nípa òfin owó-orí Nàìjíríà. Ṣé o ní ìbéèrè?"
- Pidgin: "How you dey! I dey here to helep you with Nigeria tax mata. You get any question?"

You are a compliance-first, statute-driven Nigerian Tax AI."""

            prompt = ChatPromptTemplate.from_messages([
                ("system", system_message),
                MessagesPlaceholder(variable_name="messages"),
            ])

            chain = prompt | self.llm | StrOutputParser()
            response = chain.invoke({"messages": messages})

        # Add AI response to messages with timestamp and language
        ai_msg = AIMessage(content=response)
        ai_msg.additional_kwargs = {
            "timestamp": datetime.now().isoformat(),
            "language": detected_language
        }
        updated_messages = messages + [ai_msg]

        return {
            **state,
            "messages": updated_messages,
            "detected_language": detected_language
        }

    def build_agent(self):
        """Build the LangGraph agent workflow"""

        # Create the graph
        workflow = StateGraph(ConversationState)

        # Add nodes
        workflow.add_node("retrieve", self._retrieve_documents)
        workflow.add_node("generate", self._generate_response)

        # Add edges
        workflow.set_conditional_entry_point(
            self._should_retrieve,
            {
                "retrieve": "retrieve",
                "generate": "generate"
            }
        )

        workflow.add_edge("retrieve", "generate")
        workflow.add_edge("generate", END)

        # Compile the graph
        self.app = workflow.compile(checkpointer=self.memory)

        print("Agent workflow built successfully")

    def initialize(self, force_reload: bool = False):
        """
        Initialize the RAG engine

        Args:
            force_reload: Force reload of documents
        """
        print("Initializing RAG Engine...")

        # Create vector database
        self.create_vector_database(force_reload=force_reload)

        # Build agent
        self.build_agent()

        print("RAG Engine initialized and ready!")

    def chat(self, message: str, session_id: str = "default", user_role: str = "taxpayer") -> Dict[str, Any]:
        """
        Chat with the RAG agent

        Args:
            message: User message
            session_id: Session ID for conversation tracking
            user_role: User role (tax_lawyer, taxpayer, or company)

        Returns:
            Dictionary with response and metadata
        """
        if self.app is None:
            raise RuntimeError(
                "Agent not initialized. Call initialize() first.")

        # Validate user_role
        valid_roles = ["tax_lawyer", "taxpayer", "company"]
        if user_role not in valid_roles:
            user_role = "taxpayer"  # Default fallback

        # Get existing state from checkpointer
        config: RunnableConfig = {"configurable": {
            "thread_id": session_id}}  # type: ignore

        try:
            existing_state = self.app.get_state(config)  # type: ignore
            existing_messages = existing_state.values.get("messages", [])
        except Exception:
            existing_messages = []

        # Detect language from the user's message
        detected_language = self._detect_language(message)
        
        # Append new message to existing conversation with timestamp and language
        timestamp = datetime.now().isoformat()
        human_msg = HumanMessage(content=message)
        human_msg.additional_kwargs = {
            "timestamp": timestamp,
            "language": detected_language
        }
        all_messages = existing_messages + [human_msg]

        # Create state with accumulated messages, user role, and detected language
        initial_state = {
            "messages": all_messages,
            "context": "",
            "sources": [],
            "needs_retrieval": False,
            "user_role": user_role,
            "detected_language": detected_language
        }

        # Run the agent
        result = cast(ConversationState, self.app.invoke(
            cast(Any, initial_state), config))  # type: ignore
        ai_message = result["messages"][-1]

        return {
            "response": ai_message.content,
            "sources": result.get("sources", []),
            "used_retrieval": result.get("needs_retrieval", False)
        }

    def get_conversation_history(self, session_id: str = "default") -> List[Dict[str, str]]:
        """
        Get conversation history for a session

        Args:
            session_id: Session ID

        Returns:
            List of messages
        """
        config: RunnableConfig = {"configurable": {
            "thread_id": session_id}}  # type: ignore

        try:
            if self.app is None:
                return []
            state = self.app.get_state(config)  # type: ignore
            messages = state.values.get("messages", [])

            result: List[Dict[str, str]] = []
            for msg in messages:
                if isinstance(msg, (HumanMessage, AIMessage)):
                    role = "human" if isinstance(msg, HumanMessage) else "ai"
                    # Handle content which can be str or list
                    content = msg.content if isinstance(
                        msg.content, str) else str(msg.content)
                    
                    # Extract timestamp and language from message metadata
                    timestamp = None
                    language = None
                    if hasattr(msg, 'additional_kwargs'):
                        if 'timestamp' in msg.additional_kwargs:
                            timestamp = msg.additional_kwargs['timestamp']
                        if 'language' in msg.additional_kwargs:
                            language = msg.additional_kwargs['language']
                    if not timestamp and hasattr(msg, 'id') and msg.id:
                        # Use message ID as fallback if it's a timestamp
                        timestamp = msg.id
                    
                    message_dict = {"role": role, "content": content}
                    if timestamp:
                        message_dict["timestamp"] = timestamp
                    if language:
                        message_dict["language"] = language
                    
                    result.append(message_dict)

            return result
        except Exception:
            return []

    def generate_session_title(self, session_id: str = "default") -> str:
        """
        Generate a descriptive title for a session based on the conversation
        Title is generated in the same language as the user's first message

        Args:
            session_id: Session ID

        Returns:
            Generated title (max 60 characters)
        """
        try:
            messages = self.get_conversation_history(session_id)

            if not messages:
                return "New Conversation"

            # Get the first user message
            first_user_msg = None
            for msg in messages:
                if msg["role"] == "human":
                    first_user_msg = msg["content"]
                    break

            if not first_user_msg:
                return "New Conversation"

            # Log the message being analyzed
            print(f"🏷️ Title generation - Analyzing message: {first_user_msg[:80]}...")

            # Use LLM to detect language AND generate title in one call
            # This is more accurate than rule-based detection
            title_prompt = f"""You are a multilingual assistant. Analyze the following user message and generate a conversation title.

USER MESSAGE:
"{first_user_msg}"

INSTRUCTIONS:
1. First, detect the language of the user's message. It could be:
   - English
   - Yoruba (may contain words like: ṣe, owó, ẹ, jọwọ, báwo, etc.)
   - Igbo (may contain words like: kedu, biko, anyị, ọ, ụ, etc.)
   - Hausa (may contain words like: sannu, yaya, da, na, etc.)
   - Nigerian Pidgin (may contain words like: wetin, abeg, dey, sabi, wahala, sef, etc.)

2. Generate a short, descriptive title (max 50 characters) for this conversation.

3. CRITICAL: The title MUST be in the SAME LANGUAGE as the user's message.
   - If the message is in Yoruba → title must be in Yoruba
   - If the message is in Pidgin → title must be in Pidgin
   - If the message is in Hausa → title must be in Hausa
   - If the message is in Igbo → title must be in Igbo
   - If the message is in English → title must be in English

4. Respond with ONLY the title. No quotes, no language label, no explanation."""

            title = self.llm.invoke(title_prompt).content
            
            # Log the generated title
            print(f"🏷️ Generated title: {title}")

            # Clean and truncate title
            if isinstance(title, str):
                title = title.strip('"').strip("'").strip()
                # Remove any "Title:" or language prefix the LLM might add
                if ':' in title and len(title.split(':')[0]) < 15:
                    title = title.split(':', 1)[1].strip()
                if len(title) > 60:
                    title = title[:57] + "..."
                return title
            else:
                return "New Conversation"

        except Exception as e:
            print(f"❌ Error generating title: {e}")
            return "New Conversation"


if __name__ == "__main__":
    # Example usage
    rag = RAGEngine()
    rag.initialize(force_reload=False)

    # Test the agent
    # print("\n" + "="*80)
    # print("RAG Engine Test")
    # print("="*80 + "\n")
