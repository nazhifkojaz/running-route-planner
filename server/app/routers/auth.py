import secrets
import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature

from ..core.config import STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URL, FRONTEND_ORIGIN
from ..core.security import signer, set_cookie
from ..crud import get_user_by_athlete_id, upsert_user_tokens, create_session

router = APIRouter()

@router.get("/auth/strava/start")
async def auth_start(redirect: str | None = None):
    if not (STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET and STRAVA_REDIRECT_URL):
        raise HTTPException(500, "Missing STRAVA_* envs")
    state_val = secrets.token_urlsafe(16)
    resp = RedirectResponse(
        "https://www.strava.com/oauth/authorize?" + urlencode({
            "client_id": STRAVA_CLIENT_ID,
            "redirect_uri": STRAVA_REDIRECT_URL,
            "response_type": "code",
            "scope": "read,activity:read_all",
            "state": state_val,
            "approval_prompt": "auto",
        }), status_code=302
    )
    set_cookie(resp, "oauth_state", signer.dumps(state_val), max_age=600)
    if redirect:
        set_cookie(resp, "return_to", signer.dumps(redirect), max_age=600)
    return resp

@router.get("/auth/strava/callback")
async def auth_callback(request: Request, code: str, state: str):
    sc = request.cookies.get("oauth_state")
    if not sc:
        raise HTTPException(400, "Missing oauth_state")
    try:
        expected = signer.loads(sc)
    except BadSignature:
        raise HTTPException(400, "Bad state")
    if expected != state:
        raise HTTPException(400, "State mismatch")

    async with httpx.AsyncClient() as hc:
        r = await hc.post("https://www.strava.com/oauth/token", data={
            "client_id": STRAVA_CLIENT_ID,
            "client_secret": STRAVA_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
        })
    if r.status_code != 200:
        raise HTTPException(502, "Token exchange failed")

    tok = r.json()
    athlete = tok.get("athlete")
    if not athlete or "id" not in athlete:
        raise HTTPException(502, "Invalid Strava response")
    aid = athlete["id"]

    user_id = upsert_user_tokens(
        aid=aid,
        access_token=tok["access_token"],
        refresh_token=tok["refresh_token"],
        expires_at=tok["expires_at"],
        user_id=None,
    )

    sid = str(uuid.uuid4())
    secret = secrets.token_urlsafe(16)
    create_session(user_id, secret, sid)

    session_token = signer.dumps([sid, secret])

    ret = None
    raw_return = request.cookies.get("return_to")
    if raw_return:
        try:
            ret = signer.loads(raw_return)
        except BadSignature:
            ret = None
    if not ret:
        ret = FRONTEND_ORIGIN + "/#connected=strava"

    if "#" in ret:
        ret = ret + "&connected=strava&session=" + session_token
    else:
        ret = ret + "#connected=strava&session=" + session_token

    resp = RedirectResponse(ret, status_code=302)
    set_cookie(resp, "sid", signer.dumps([sid, secret]), max_age=86400 * 30)

    resp.delete_cookie("oauth_state", path="/")
    resp.delete_cookie("return_to", path="/")
    return resp
