"""
Unit tests for TrellisClient configuration and initialization.
"""

import unittest
from trellis import TrellisClient


class TestTrellisClient(unittest.TestCase):
    def test_client_initialization(self):
        client = TrellisClient("127.0.0.1", 9090)
        self.assertEqual(client.host, "127.0.0.1")
        self.assertEqual(client.port, 9090)
        self.assertEqual(client.base_url, "http://127.0.0.1:9090")


if __name__ == "__main__":
    unittest.main()
