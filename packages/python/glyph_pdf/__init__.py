"""glyph-pdf — Generate PDFs with AI. Zero dependencies."""

from __future__ import annotations

import json
import urllib.request
import urllib.error
import urllib.parse
from typing import Any, Dict, List, Optional


__version__ = "0.1.0"
__all__ = ["Glyph", "GlyphError", "glyph"]


class GlyphError(Exception):
    """Structured error from the Glyph API."""

    def __init__(self, message: str, status: int, code: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code

    def __repr__(self) -> str:
        return f"GlyphError({self.code!r}, {self.message!r}, status={self.status})"

    @property
    def message(self) -> str:
        return str(self)


class Glyph:
    """Client for the Glyph PDF API.

    Usage::

        glyph = Glyph("gk_your_api_key")
        result = glyph.create(data={"company": "Acme Corp", "total": "$1,250.00"})
        print(result["url"])
    """

    def __init__(self, api_key: str, *, base_url: str = "https://api.glyph.you") -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    # -- Public methods -------------------------------------------------------

    def create(
        self,
        *,
        data: Optional[Dict[str, Any]] = None,
        html: Optional[str] = None,
        url: Optional[str] = None,
        template_id: Optional[str] = None,
        intent: Optional[str] = None,
        style: Optional[str] = None,
        format: str = "pdf",
        options: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generate a PDF or PNG from data, HTML, or a URL.

        Returns a dict with ``url``, ``sessionId``, ``format``, ``size``,
        ``filename``, ``expiresAt``, and optional ``analysis``.
        """
        body: Dict[str, Any] = {"format": format}
        if data is not None:
            body["data"] = data
        if html is not None:
            body["html"] = html
        if url is not None:
            body["url"] = url
        if template_id is not None:
            body["templateId"] = template_id
        if intent is not None:
            body["intent"] = intent
        if style is not None:
            body["style"] = style
        if options is not None:
            body["options"] = options
        if ttl is not None:
            body["ttl"] = ttl
        return self._request("POST", "/v1/create", body)

    def templates(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """List available templates. Optionally filter by *category*."""
        path = "/v1/templates"
        if category is not None:
            path += "?" + urllib.parse.urlencode({"category": category})
        result = self._request("GET", path)
        return result.get("templates", [])

    def template_schema(self, template_id: str) -> Dict[str, Any]:
        """Get the JSON schema for a template."""
        encoded = urllib.parse.quote(template_id, safe="")
        return self._request("GET", f"/v1/templates/{encoded}/schema")

    # -- Internal -------------------------------------------------------------

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self._base_url}{path}"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        data_bytes: Optional[bytes] = None
        if body is not None:
            data_bytes = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            try:
                error_body = json.loads(exc.read().decode("utf-8"))
            except Exception:
                error_body = {}
            raise GlyphError(
                message=error_body.get("error", f"Request failed with status {exc.code}"),
                status=exc.code,
                code=error_body.get("code", "UNKNOWN_ERROR"),
            ) from exc
        except urllib.error.URLError as exc:
            raise GlyphError(
                message=f"Connection error: {exc.reason}",
                status=0,
                code="CONNECTION_ERROR",
            ) from exc


def glyph(api_key: str, *, base_url: str = "https://api.glyph.you") -> Glyph:
    """Factory function. Returns a :class:`Glyph` instance."""
    return Glyph(api_key, base_url=base_url)
