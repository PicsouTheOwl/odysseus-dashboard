"""
src/hermes_agent.py — Client pour le Hermes Bridge (OWL Agent)
Appelle le bridge HTTP local qui transmet les requêtes à l'agent Hermes.
"""
import httpx
import json
import logging
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

BRIDGE_URL = "http://127.0.0.1:8643"

async def chat_with_agent(
    message: str,
    session_id: Optional[str] = None,
    context: Optional[str] = None,
    email_uid: Optional[str] = None,
    email_folder: Optional[str] = None,
    task: Optional[str] = None,
) -> str:
    """Envoie un message à l'agent Hermes via le bridge."""
    payload = {
        "message": message,
        "session_id": session_id,
        "context": context,
        "email_uid": email_uid,
        "email_folder": email_folder or "INBOX",
        "task": task,
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{BRIDGE_URL}/chat", json=payload)
            if r.status_code == 200:
                data = r.json()
                return data.get("response", "")
            else:
                logger.error(f"Hermes bridge error {r.status_code}: {r.text[:200]}")
                return f"Erreur agent: {r.status_code}"
    except Exception as e:
        logger.error(f"Hermes bridge unreachable: {e}")
        return "L'agent Hermes n'est pas disponible."


async def summarize_email(email_data: dict) -> str:
    """Demande à l'agent de résumer un email."""
    uid = email_data.get("uid", "")
    folder = email_data.get("folder", "INBOX")
    subject = email_data.get("subject", "")
    sender = email_data.get("from_name", email_data.get("from_address", ""))
    body = email_data.get("body", "") or email_data.get("body_html", "") or ""
    
    context = f"""Email à résumer:
De: {sender}
Sujet: {subject}
Corps: {body[:3000]}
"""
    
    return await chat_with_agent(
        message="Résume cet email en 2-3 phrases et propose une action si nécessaire.",
        context=context,
        email_uid=str(uid),
        email_folder=folder,
        task="summarize",
    )


async def draft_reply(email_data: dict, instruction: str = "") -> str:
    """Demande à l'agent de rédiger une réponse."""
    uid = email_data.get("uid", "")
    folder = email_data.get("folder", "INBOX")
    subject = email_data.get("subject", "")
    sender = email_data.get("from_name", email_data.get("from_address", ""))
    sender_email = email_data.get("from_address", "")
    body = email_data.get("body", "") or email_data.get("body_html", "") or ""
    
    context = f"""Email auquel répondre:
De: {sender} <{sender_email}>
Sujet: {subject}
Corps: {body[:3000]}

Instruction de l'utilisateur: {instruction or 'Rédiger une réponse professionnelle'}
"""
    
    return await chat_with_agent(
        message=f"Rédige une réponse à cet email. {instruction}",
        context=context,
        email_uid=str(uid),
        email_folder=folder,
        task="reply",
    )
