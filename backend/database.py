"""
Supabase Database Configuration for Authentication
Uses Supabase Python client for database operations
"""

import os
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load environment variables from backend/.env file
backend_dir = Path(__file__).parent.resolve()
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(env_path)

from supabase import create_client, Client

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")  # Use service_role key for backend

# Initialize Supabase client
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase client initialized")
else:
    print("⚠️ Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_KEY environment variables.")


# =============================================
# USER CLASS FOR COMPATIBILITY
# =============================================

class User:
    """User class for compatibility with existing code"""
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id")
        self.email = data.get("email")
        self.username = data.get("username")
        self.password = data.get("password")
        self.auth_provider = data.get("auth_provider", "local")
        self.created_at = self._parse_datetime(data.get("created_at"))
        self.last_login = self._parse_datetime(data.get("last_login"))
        self.is_active = data.get("is_active", True)
    
    def _parse_datetime(self, value):
        """Parse datetime from string or return as-is"""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except:
            return None
    
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "password": self.password,
            "auth_provider": self.auth_provider,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "is_active": self.is_active
        }


# =============================================
# DATABASE SESSION COMPATIBILITY
# =============================================

class SupabaseSession:
    """Wrapper class for Supabase to maintain compatibility with existing code"""
    def __init__(self, client: Optional[Client]):
        self.client = client
    
    def close(self):
        """No-op for Supabase (connection pooling handled automatically)"""
        pass


def get_db():
    """Get database session - use as dependency in FastAPI"""
    session = SupabaseSession(supabase)
    try:
        yield session
    finally:
        session.close()


def get_db_session() -> SupabaseSession:
    """Get a new database session - use for direct calls"""
    return SupabaseSession(supabase)


# =============================================
# USER CRUD OPERATIONS
# =============================================

def get_user_by_id(db: SupabaseSession, user_id: str) -> Optional[User]:
    """Get user by ID"""
    if not db.client:
        return None
    
    try:
        response = db.client.table("users").select("*").eq("id", user_id).single().execute()
        if response.data:
            return User(response.data)
        return None
    except Exception as e:
        print(f"Error getting user by ID: {e}")
        return None


def get_user_by_email(db: SupabaseSession, email: str) -> Optional[User]:
    """Get user by email (case-insensitive)"""
    if not db.client:
        return None
    
    try:
        response = db.client.table("users").select("*").eq("email", email.lower()).single().execute()
        if response.data:
            return User(response.data)
        return None
    except Exception as e:
        # User not found is not an error
        if "0 rows" in str(e) or "multiple" not in str(e).lower():
            return None
        print(f"Error getting user by email: {e}")
        return None


def create_user(
    db: SupabaseSession,
    user_id: str,
    email: str,
    username: str,
    password: Optional[str] = None,
    auth_provider: str = "local"
) -> User:
    """Create a new user"""
    if not db.client:
        raise Exception("Supabase client not initialized")
    
    user_data = {
        "id": user_id,
        "email": email.lower(),
        "username": username,
        "password": password,
        "auth_provider": auth_provider,
        "created_at": datetime.utcnow().isoformat(),
        "is_active": True
    }
    
    response = db.client.table("users").insert(user_data).execute()
    
    if response.data:
        return User(response.data[0])
    else:
        raise Exception("Failed to create user")


def update_user_last_login(db: SupabaseSession, user: User) -> User:
    """Update user's last login timestamp"""
    if not db.client:
        return user
    
    try:
        now = datetime.utcnow().isoformat()
        response = db.client.table("users").update(
            {"last_login": now}
        ).eq("id", user.id).execute()
        
        if response.data:
            return User(response.data[0])
        return user
    except Exception as e:
        print(f"Error updating last login: {e}")
        return user


# =============================================
# IP TRACKING & SESSION MANAGEMENT
# =============================================

def get_user_ips(db: SupabaseSession, user_id: str) -> list:
    """Get all registered IP addresses for a user"""
    if not db.client:
        return []
    
    try:
        response = db.client.table("user_ips").select("*").eq("user_id", user_id).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting user IPs: {e}")
        return []


def is_new_ip_for_user(db: SupabaseSession, user_id: str, ip_address: str) -> bool:
    """Check if this IP address is new for the user"""
    if not db.client:
        return True
    
    try:
        response = db.client.table("user_ips").select("id").eq("user_id", user_id).eq("ip_address", ip_address).execute()
        return not response.data or len(response.data) == 0
    except Exception as e:
        print(f"Error checking IP: {e}")
        return True


def register_user_ip(db: SupabaseSession, user_id: str, ip_address: str, user_agent: str = None) -> Dict[str, Any]:
    """Register a new IP address for a user and create a new session"""
    if not db.client:
        return None
    
    import uuid
    
    try:
        # Create IP record
        ip_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "first_seen": datetime.utcnow().isoformat(),
            "last_seen": datetime.utcnow().isoformat()
        }
        
        response = db.client.table("user_ips").insert(ip_data).execute()
        
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error registering IP: {e}")
        return None


def update_ip_last_seen(db: SupabaseSession, user_id: str, ip_address: str) -> None:
    """Update the last seen timestamp for an IP"""
    if not db.client:
        return
    
    try:
        db.client.table("user_ips").update(
            {"last_seen": datetime.utcnow().isoformat()}
        ).eq("user_id", user_id).eq("ip_address", ip_address).execute()
    except Exception as e:
        print(f"Error updating IP last seen: {e}")


def create_user_session(db: SupabaseSession, user_id: str, ip_address: str = None, session_id: str = None) -> str:
    """Create a new chat session for a user, optionally from a specific IP"""
    if not db.client:
        return None
    
    import uuid
    
    try:
        # Use provided session_id or generate a new one
        final_session_id = session_id or str(uuid.uuid4())
        session_data = {
            "session_id": final_session_id,
            "user_id": user_id,
            "ip_address": ip_address,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat(),
            "title": "New Conversation"
        }
        
        response = db.client.table("sessions").insert(session_data).execute()
        
        if response.data:
            print(f"📝 Created new session {final_session_id} for user {user_id} from IP {ip_address}")
            return final_session_id
        return None
    except Exception as e:
        print(f"Error creating session: {e}")
        return None


def get_user_sessions(db: SupabaseSession, user_id: str) -> list:
    """Get all sessions for a user"""
    if not db.client:
        return []
    
    try:
        response = db.client.table("sessions").select("*").eq("user_id", user_id).order("last_activity", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting user sessions: {e}")
        return []


def get_session_owner(db: SupabaseSession, session_id: str) -> Optional[str]:
    """Get the owner (user_id) of a session. Returns None if session doesn't exist or has no owner."""
    if not db.client:
        return None
    
    try:
        response = db.client.table("sessions").select("user_id").eq("session_id", session_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0].get("user_id")
        return None
    except Exception as e:
        print(f"Error getting session owner: {e}")
        return None


def verify_session_ownership(db: SupabaseSession, session_id: str, user_id: str) -> bool:
    """Verify that a session belongs to a specific user"""
    if not db.client:
        return False
    
    try:
        response = db.client.table("sessions").select("user_id").eq("session_id", session_id).eq("user_id", user_id).execute()
        return response.data and len(response.data) > 0
    except Exception as e:
        print(f"Error verifying session ownership: {e}")
        return False


def delete_user_session(db: SupabaseSession, session_id: str, user_id: str) -> bool:
    """Delete a session only if it belongs to the user"""
    if not db.client:
        return False
    
    try:
        response = db.client.table("sessions").delete().eq("session_id", session_id).eq("user_id", user_id).execute()
        return response.data and len(response.data) > 0
    except Exception as e:
        print(f"Error deleting session: {e}")
        return False


def update_session_title(db: SupabaseSession, session_id: str, title: str) -> bool:
    """Update the title of a session"""
    if not db.client:
        return False
    
    try:
        db.client.table("sessions").update(
            {"title": title, "last_activity": datetime.utcnow().isoformat()}
        ).eq("session_id", session_id).execute()
        return True
    except Exception as e:
        print(f"Error updating session title: {e}")
        return False


def update_session_activity(db: SupabaseSession, session_id: str, message_count: int = None) -> bool:
    """Update the last activity timestamp and optionally message count for a session"""
    if not db.client:
        return False
    
    try:
        update_data = {"last_activity": datetime.utcnow().isoformat()}
        if message_count is not None:
            update_data["message_count"] = message_count
        
        db.client.table("sessions").update(update_data).eq("session_id", session_id).execute()
        return True
    except Exception as e:
        print(f"Error updating session activity: {e}")
        return False


# =============================================
# TABLE CREATION SQL (Run in Supabase SQL Editor)
# =============================================

SUPABASE_TABLE_SQL = """
-- Create users table in Supabase
-- Run this SQL in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(30) NOT NULL,
    password VARCHAR(64),
    auth_provider VARCHAR(20) DEFAULT 'local',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create user_ips table for IP tracking
CREATE TABLE IF NOT EXISTS user_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, ip_address)
);

-- Create index for IP lookups
CREATE INDEX IF NOT EXISTS idx_user_ips_user ON user_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ips_ip ON user_ips(ip_address);

-- Create sessions table for chat sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    title VARCHAR(255) DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_count INTEGER DEFAULT 0
);

-- Create index for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Service role has full access to users" ON users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to user_ips" ON user_ips
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to sessions" ON sessions
    FOR ALL USING (true) WITH CHECK (true);
"""

def print_setup_instructions():
    """Print setup instructions for Supabase"""
    print("""
╔══════════════════════════════════════════════════════════════════╗
║                    SUPABASE SETUP INSTRUCTIONS                   ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  1. Create a Supabase project at https://supabase.com            ║
║                                                                  ║
║  2. Go to Project Settings > API and copy:                       ║
║     - Project URL (SUPABASE_URL)                                 ║
║     - service_role key (SUPABASE_KEY) - NOT the anon key         ║
║                                                                  ║
║  3. Set environment variables:                                   ║
║     SUPABASE_URL=https://your-project.supabase.co                ║
║     SUPABASE_KEY=your-service-role-key                           ║
║                                                                  ║
║  4. Run the following SQL in Supabase SQL Editor:                ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")
    print(SUPABASE_TABLE_SQL)


# Print setup instructions if Supabase is not configured
if not supabase:
    print_setup_instructions()


# =============================================
# MESSAGE PERSISTENCE FUNCTIONS
# =============================================
def save_message(db: 'SupabaseSession', session_id: str, user_id: str, role: str, content: str, message_index: int, timestamp: str = None):
    """
    Save a chat message to the Supabase 'messages' table.
    """
    if timestamp is None:
        from datetime import datetime
        timestamp = datetime.utcnow().isoformat()
    data = {
        "session_id": session_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "message_index": message_index,
        "timestamp": timestamp
    }
    response = db.client.table("messages").insert(data).execute()
    return response


def get_messages_for_session(db: 'SupabaseSession', session_id: str):
    """
    Retrieve all messages for a given session_id, ordered by message_index.
    Returns a list of message dicts.
    """
    response = db.client.table("messages") \
        .select("*") \
        .eq("session_id", session_id) \
        .order("message_index", desc=False) \
        .execute()
    if hasattr(response, 'data'):
        return response.data
    return []
