"""
Nigerian Tax Reform Bills Document Question Answering
Uses LangChain for document processing and LangGraph for agentic retrieval
"""

from typing import List, Dict, Any, TypedDict, Annotated, cast, Optional
from pathlib import Path

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

            # Add metadata
            for doc in docs:
                doc.metadata["source_file"] = pdf_file.name
                doc.metadata["source_path"] = str(pdf_file)

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
        """
        messages = state["messages"]
        last_msg = messages[-1] if messages else None
        last_message = str(last_msg.content) if last_msg else ""

        # Retrieve relevant documents
        if self.retriever is None:
            raise RuntimeError("Retriever not initialized")
        docs = self.retriever.invoke(last_message)

        # Format context with source citations
        context_parts = []
        sources = []

        for i, doc in enumerate(docs, 1):
            source_info = {
                "source_file": doc.metadata.get("source_file", "Unknown"),
                "page": doc.metadata.get("page", "Unknown"),
                "content_preview": doc.page_content[:200] + "..."
            }
            sources.append(source_info)

            context_parts.append(
                f"[Source {i}: {source_info['source_file']}, Page {source_info['page']}]\n{doc.page_content}\n"
            )

        context = "\n---\n".join(context_parts)

        return {
            **state,
            "context": context,
            "sources": sources,
            "needs_retrieval": True
        }

    def _generate_response(self, state: ConversationState) -> ConversationState:
        """
        Agent node: Generate response with or without retrieved context
        """
        messages = state["messages"]
        context = state.get("context", "")
        sources = state.get("sources", [])

        if context:
            # Generate answer with context and citations
            system_message = """You are a helpful AI assistant specializing in Nigerian tax and revenue policy.
            
            Use the provided context to answer the question accurately. 
            
            IMPORTANT: Always cite your sources using this format at the end of relevant statements:
            [Source: filename, Page X]
            
            If the context doesn't contain enough information to answer the question, say so clearly.
            Be specific and reference exact sections when possible."""

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

            # Append sources list at the end
            if sources:
                response += "\n\n**Sources Referenced:**\n"
                for i, source in enumerate(sources, 1):
                    response += f"{i}. {source['source_file']}, Page {source['page']}\n"

        else:
            # Generate answer without context (for greetings, etc.)
            system_message = """You are a helpful AI assistant specializing in Nigerian tax and revenue policy.
            
            If asked about specific policies or legal information, suggest that the user ask a specific question 
            about the Nigeria Tax Act 2025 or related legislation."""

            prompt = ChatPromptTemplate.from_messages([
                ("system", system_message),
                MessagesPlaceholder(variable_name="messages"),
            ])

            chain = prompt | self.llm | StrOutputParser()
            response = chain.invoke({"messages": messages})

        # Add AI response to messages
        updated_messages = messages + [AIMessage(content=response)]

        return {
            **state,
            "messages": updated_messages
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

    def chat(self, message: str, session_id: str = "default") -> Dict[str, Any]:
        """
        Chat with the RAG agent

        Args:
            message: User message
            session_id: Session ID for conversation tracking

        Returns:
            Dictionary with response and metadata
        """
        if self.app is None:
            raise RuntimeError(
                "Agent not initialized. Call initialize() first.")

        # Get existing state from checkpointer
        config: RunnableConfig = {"configurable": {
            "thread_id": session_id}}  # type: ignore

        try:
            existing_state = self.app.get_state(config)  # type: ignore
            existing_messages = existing_state.values.get("messages", [])
        except Exception:
            existing_messages = []

        # Append new message to existing conversation
        all_messages = existing_messages + [HumanMessage(content=message)]

        # Create state with accumulated messages
        initial_state = {
            "messages": all_messages,
            "context": "",
            "sources": [],
            "needs_retrieval": False
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
                    result.append({"role": role, "content": content})

            return result
        except Exception:
            return []

    def generate_session_title(self, session_id: str = "default") -> str:
        """
        Generate a descriptive title for a session based on the conversation

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
            first_user_msg = next(
                (msg["content"] for msg in messages if msg["role"] == "human"),
                None
            )

            if not first_user_msg:
                return "New Conversation"

            # Use LLM to generate a concise title
            title_prompt = f"""Generate a short, descriptive title (max 60 characters) for a conversation that starts with this question:

"{first_user_msg}"

Respond with ONLY the title, no quotes or extra text."""

            title = self.llm.invoke(title_prompt).content

            # Clean and truncate title
            if isinstance(title, str):
                title = title.strip('"').strip()
                if len(title) > 60:
                    title = title[:57] + "..."
                return title
            else:
                return "New Conversation"

        except Exception:
            return "New Conversation"


if __name__ == "__main__":
    # Example usage
    rag = RAGEngine()
    rag.initialize(force_reload=False)

    # Test the agent
    # print("\n" + "="*80)
    # print("RAG Engine Test")
    # print("="*80 + "\n")
