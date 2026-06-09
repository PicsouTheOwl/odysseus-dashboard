"""
routes/hermes_agent_routes.py — Routes pour l'intégration Hermes Agent (OWL)
Fait le pont entre Odysseus et l'agent Hermes via le bridge HTTP local.
"""
import logging
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional

from src.hermes_agent import chat_with_agent, summarize_email, draft_reply
from routes.email_helpers import require_owner

logger = logging.getLogger(__name__)


class AgentChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    context: Optional[str] = None
    email_uid: Optional[str] = None
    email_folder: Optional[str] = "INBOX"
    task: Optional[str] = None


class AgentChatResponse(BaseModel):
    session_id: str
    response: str


def setup_hermes_agent_routes():
    router = APIRouter(prefix="/api/agent", tags=["agent"])

    @router.post("/chat", response_model=AgentChatResponse)
    async def agent_chat(req: AgentChatRequest, owner: str = Depends(require_owner)):
        """Envoie un message à l'agent Hermes."""
        response = await chat_with_agent(
            message=req.message,
            session_id=req.session_id,
            context=req.context,
            email_uid=req.email_uid,
            email_folder=req.email_folder,
            task=req.task,
        )
        return AgentChatResponse(
            session_id=req.session_id or "default",
            response=response,
        )

    @router.post("/email/summarize")
    async def agent_summarize(data: dict, owner: str = Depends(require_owner)):
        """Résume un email via l'agent Hermes."""
        result = await summarize_email(data)
        return {"success": True, "summary": result}

    @router.post("/email/reply")
    async def agent_reply(data: dict, owner: str = Depends(require_owner)):
        """Rédige une réponse via l'agent Hermes."""
        instruction = data.get("instruction", "")
        result = await draft_reply(data, instruction)
        return {"success": True, "reply": result}

    @router.get("/health")
    async def agent_health():
        return {"status": "ok", "agent": "hermes-owl"}

    return router
