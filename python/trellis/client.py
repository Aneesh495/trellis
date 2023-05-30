"""
HTTP and WebSocket client for Trellis real-time collaboration daemon.
"""

import json
import urllib.request
import urllib.error
from typing import Dict, List, Any, Optional


class TrellisClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 8080):
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"

    def get_health(self) -> Dict[str, Any]:
        """
        Queries server health status and version.
        """
        url = f"{self.base_url}/health"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))

    def get_sessions(self) -> List[Dict[str, Any]]:
        """
        Retrieves active collaboration session summaries.
        """
        url = f"{self.base_url}/api/sessions"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))

    def eval(self, formula: str, session_id: str = "default", sheet_name: Optional[str] = None) -> Any:
        """
        Evaluates a formula remotely on the server.
        """
        url = f"{self.base_url}/api/eval"
        payload = {
            "formula": formula,
            "sessionId": session_id
        }
        if sheet_name:
            payload["sheetName"] = sheet_name

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if "error" in res_data:
                raise RuntimeError(f"Server evaluation error: {res_data['error']}")
            return res_data.get("result")
